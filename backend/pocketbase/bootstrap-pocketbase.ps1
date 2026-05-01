[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SuperuserEmail,

    [Parameter(Mandatory = $true)]
    [string]$SuperuserPassword,

    [string]$AppUrl = "http://127.0.0.1:8090",
    [string]$WorkspaceSlug = "main",
    [string]$WorkspaceName = "Fideo Main",
    [string]$UserEmail = "admin@fideo.local",
    [string]$UserPassword = "ChangeMe123!",
    [string]$UserName = "Fideo Local Admin",

    [ValidateSet("Admin", "Repartidor", "Empacador", "Cajero", "Cliente", "Proveedor")]
    [string]$UserRole = "Admin",

    [Nullable[bool]]$CanSwitchRoles = $null,
    [string]$EmployeeId = "",
    [string]$CustomerId = "",
    [string]$SupplierId = "",
    [string]$PushExternalId = "",
    [int]$TimeoutSeconds = 30,
    [switch]$ResetUserPassword
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Join-ApiUrl {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    return "{0}{1}" -f $BaseUrl.TrimEnd("/"), $Path
}

function ConvertTo-FilterLiteral {
    param([string]$Value)

    $escaped = $Value.Replace("\", "\\").Replace("'", "\'")
    return "'$escaped'"
}

function Get-RecordValue {
    param(
        [object]$Record,
        [string]$FieldName
    )

    if ($null -eq $Record) {
        return $null
    }

    $property = $Record.PSObject.Properties[$FieldName]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Resolve-NonEmptyText {
    param(
        [string]$ExplicitValue,
        [string]$ExistingValue,
        [string]$FallbackValue = ""
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
        return $ExplicitValue.Trim()
    }

    if (-not [string]::IsNullOrWhiteSpace($ExistingValue)) {
        return $ExistingValue.Trim()
    }

    return $FallbackValue
}

function ConvertTo-SlugPart {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return "user"
    }

    $normalized = $Value.Trim().ToLowerInvariant()
    $normalized = $normalized -replace "[^a-z0-9]+", "-"
    $normalized = $normalized.Trim("-")

    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return "user"
    }

    return $normalized
}

function Resolve-PushExternalId {
    param(
        [string]$ExplicitValue,
        [string]$ExistingValue,
        [string]$WorkspaceSlugValue,
        [string]$RoleValue,
        [string]$EmailValue
    )

    $resolved = Resolve-NonEmptyText -ExplicitValue $ExplicitValue -ExistingValue $ExistingValue
    if (-not [string]::IsNullOrWhiteSpace($resolved)) {
        return $resolved
    }

    $localPart = if ($EmailValue -match "@") { $EmailValue.Split("@")[0] } else { $EmailValue }
    return "fideo-{0}-{1}-{2}" -f `
        (ConvertTo-SlugPart -Value $WorkspaceSlugValue), `
        (ConvertTo-SlugPart -Value $RoleValue), `
        (ConvertTo-SlugPart -Value $localPart)
}

function Resolve-CanSwitchRolesValue {
    param(
        [Nullable[bool]]$ExplicitValue,
        [object]$ExistingValue,
        [string]$RoleValue
    )

    if ($null -ne $ExplicitValue) {
        return [bool]$ExplicitValue
    }

    if ($null -ne $ExistingValue) {
        return [bool]$ExistingValue
    }

    return $RoleValue -notin @("Cliente", "Proveedor")
}

function Resolve-EmployeeIdFromSnapshot {
    param(
        [object]$Snapshot,
        [string]$RoleValue,
        [string]$UserNameValue,
        [string]$UserEmailValue
    )

    if ($RoleValue -notin @("Admin", "Repartidor", "Empacador", "Cajero")) {
        return ""
    }

    $employees = @()
    if ($null -ne $Snapshot) {
        $employees = @($Snapshot.employees)
    }

    if ($employees.Count -eq 0) {
        return ""
    }

    $normalizedName = if ([string]::IsNullOrWhiteSpace($UserNameValue)) { "" } else { $UserNameValue.Trim().ToLowerInvariant() }
    $normalizedLocalPart = if ([string]::IsNullOrWhiteSpace($UserEmailValue)) { "" } else { ($UserEmailValue.Split("@")[0]).Trim().ToLowerInvariant() }

    foreach ($employee in $employees) {
        $employeeName = [string](Get-RecordValue -Record $employee -FieldName "name")
        $employeeIdValue = [string](Get-RecordValue -Record $employee -FieldName "id")
        if ([string]::IsNullOrWhiteSpace($employeeName) -or [string]::IsNullOrWhiteSpace($employeeIdValue)) {
            continue
        }

        $employeeNameNormalized = $employeeName.Trim().ToLowerInvariant()

        if ($normalizedName -and $employeeNameNormalized -eq $normalizedName) {
            return $employeeIdValue
        }

        if ($normalizedLocalPart -and $employeeNameNormalized.Contains($normalizedLocalPart)) {
            return $employeeIdValue
        }
    }

    $roleMatches = @(
        $employees | Where-Object {
            ([string](Get-RecordValue -Record $_ -FieldName "role")).Trim() -eq $RoleValue
        }
    )

    if ($roleMatches.Count -eq 1) {
        return [string](Get-RecordValue -Record $roleMatches[0] -FieldName "id")
    }

    return ""
}

function Invoke-PocketBaseJson {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [hashtable]$Headers = @{}
    )

    $params = @{
        Method      = $Method
        Uri         = (Join-ApiUrl -BaseUrl $AppUrl -Path $Path)
        Headers     = $Headers
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $params["ContentType"] = "application/json"
        $params["Body"] = ($Body | ConvertTo-Json -Depth 20)
    }

    Invoke-RestMethod @params
}

function Wait-ForPocketBase {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Method Get -Uri (Join-ApiUrl -BaseUrl $AppUrl -Path "/api/health") -ErrorAction Stop
            if ($health.code -eq 200) {
                return
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    throw "PocketBase no respondio en $AppUrl despues de $TimeoutSeconds segundos."
}

function Find-FirstRecord {
    param(
        [string]$CollectionName,
        [string]$Filter,
        [hashtable]$Headers
    )

    $query = [uri]::EscapeDataString($Filter)
    $response = Invoke-PocketBaseJson `
        -Method "Get" `
        -Path ("/api/collections/{0}/records?page=1&perPage=1&filter={1}" -f $CollectionName, $query) `
        -Headers $Headers

    return @($response.items)[0]
}

Wait-ForPocketBase

$superuserAuth = Invoke-PocketBaseJson `
    -Method "Post" `
    -Path "/api/collections/_superusers/auth-with-password" `
    -Body @{
        identity = $SuperuserEmail
        password = $SuperuserPassword
    }

$superuserHeaders = @{
    Authorization = "Bearer $($superuserAuth.token)"
}

$workspace = Find-FirstRecord `
    -CollectionName "fideo_workspaces" `
    -Filter ("slug = {0}" -f (ConvertTo-FilterLiteral -Value $WorkspaceSlug)) `
    -Headers $superuserHeaders

if (-not $workspace) {
    $workspace = Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/collections/fideo_workspaces/records" `
        -Headers $superuserHeaders `
        -Body @{
            name = $WorkspaceName
            slug = $WorkspaceSlug
        }
}
elseif ($workspace.name -ne $WorkspaceName) {
    $workspace = Invoke-PocketBaseJson `
        -Method "Patch" `
        -Path ("/api/collections/fideo_workspaces/records/{0}" -f $workspace.id) `
        -Headers $superuserHeaders `
        -Body @{
            name = $WorkspaceName
            slug = $WorkspaceSlug
        }
}

$appUser = Find-FirstRecord `
    -CollectionName "fideo_users" `
    -Filter ("email = {0}" -f (ConvertTo-FilterLiteral -Value $UserEmail)) `
    -Headers $superuserHeaders

$existingEmployeeId = [string](Get-RecordValue -Record $appUser -FieldName "employeeId")
$existingCustomerId = [string](Get-RecordValue -Record $appUser -FieldName "customerId")
$existingSupplierId = [string](Get-RecordValue -Record $appUser -FieldName "supplierId")
$existingPushExternalId = [string](Get-RecordValue -Record $appUser -FieldName "pushExternalId")
$existingCanSwitchRoles = Get-RecordValue -Record $appUser -FieldName "canSwitchRoles"

$effectiveEmployeeId = Resolve-NonEmptyText -ExplicitValue $EmployeeId -ExistingValue $existingEmployeeId
$effectiveCustomerId = Resolve-NonEmptyText -ExplicitValue $CustomerId -ExistingValue $existingCustomerId
$effectiveSupplierId = Resolve-NonEmptyText -ExplicitValue $SupplierId -ExistingValue $existingSupplierId
$effectivePushExternalId = Resolve-PushExternalId `
    -ExplicitValue $PushExternalId `
    -ExistingValue $existingPushExternalId `
    -WorkspaceSlugValue $WorkspaceSlug `
    -RoleValue $UserRole `
    -EmailValue $UserEmail
$effectiveCanSwitchRoles = Resolve-CanSwitchRolesValue `
    -ExplicitValue $CanSwitchRoles `
    -ExistingValue $existingCanSwitchRoles `
    -RoleValue $UserRole

if (-not $appUser) {
    $appUser = Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/collections/fideo_users/records" `
        -Headers $superuserHeaders `
        -Body @{
            email           = $UserEmail
            password        = $UserPassword
            passwordConfirm = $UserPassword
            name            = $UserName
            role            = $UserRole
            workspace       = $workspace.id
            employeeId      = $effectiveEmployeeId
            customerId      = $effectiveCustomerId
            supplierId      = $effectiveSupplierId
            pushExternalId  = $effectivePushExternalId
            canSwitchRoles  = $effectiveCanSwitchRoles
            verified        = $true
        }
}
else {
    $updateBody = @{
        name           = $UserName
        role           = $UserRole
        workspace      = $workspace.id
        employeeId     = $effectiveEmployeeId
        customerId     = $effectiveCustomerId
        supplierId     = $effectiveSupplierId
        pushExternalId = $effectivePushExternalId
        canSwitchRoles = $effectiveCanSwitchRoles
        verified       = $true
    }

    if ($ResetUserPassword) {
        $updateBody["password"] = $UserPassword
        $updateBody["passwordConfirm"] = $UserPassword
    }

    $appUser = Invoke-PocketBaseJson `
        -Method "Patch" `
        -Path ("/api/collections/fideo_users/records/{0}" -f $appUser.id) `
        -Headers $superuserHeaders `
        -Body $updateBody
}

try {
    $appUserAuth = Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/collections/fideo_users/auth-with-password" `
        -Body @{
            identity = $UserEmail
            password = $UserPassword
        }
}
catch {
    throw "No pude autenticar al usuario de Fideo. Si ya existia con otra password, reintenta con -ResetUserPassword."
}

$bootstrap = Invoke-PocketBaseJson `
    -Method "Post" `
    -Path "/api/fideo/bootstrap" `
    -Headers @{
        Authorization = "Bearer $($appUserAuth.token)"
    } `
    -Body @{
        workspaceSlug = $WorkspaceSlug
        workspaceName = $WorkspaceName
        seedSnapshot  = @{}
    }

$bootstrapSnapshot = Get-RecordValue -Record $bootstrap -FieldName "snapshot"
$resolvedEmployeeIdFromSnapshot = Resolve-EmployeeIdFromSnapshot `
    -Snapshot $bootstrapSnapshot `
    -RoleValue $UserRole `
    -UserNameValue $UserName `
    -UserEmailValue $UserEmail

if ([string]::IsNullOrWhiteSpace($effectiveEmployeeId) -and -not [string]::IsNullOrWhiteSpace($resolvedEmployeeIdFromSnapshot)) {
    $effectiveEmployeeId = $resolvedEmployeeIdFromSnapshot
    $appUser = Invoke-PocketBaseJson `
        -Method "Patch" `
        -Path ("/api/collections/fideo_users/records/{0}" -f $appUser.id) `
        -Headers $superuserHeaders `
        -Body @{
            employeeId     = $effectiveEmployeeId
            pushExternalId = $effectivePushExternalId
        }
}

Write-Host "Bootstrap listo."
Write-Host ("Workspace: {0} ({1})" -f $bootstrap.workspaceSlug, $bootstrap.workspaceId)
Write-Host ("Usuario Fideo: {0}" -f $UserEmail)
Write-Host ("Rol: {0}" -f $UserRole)
Write-Host ("EmployeeId: {0}" -f $(if ([string]::IsNullOrWhiteSpace($effectiveEmployeeId)) { "(sin binding)" } else { $effectiveEmployeeId }))
Write-Host ("PushExternalId: {0}" -f $effectivePushExternalId)

if ($UserRole -in @("Admin", "Repartidor", "Empacador", "Cajero") -and [string]::IsNullOrWhiteSpace($effectiveEmployeeId)) {
    Write-Warning "No pude resolver employeeId automaticamente. Puedes volver a correr el helper con -EmployeeId explicito."
}
