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

    [bool]$CanSwitchRoles = $true,
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
            employeeId      = $EmployeeId
            customerId      = $CustomerId
            supplierId      = $SupplierId
            pushExternalId  = $PushExternalId
            canSwitchRoles  = $CanSwitchRoles
            verified        = $true
        }
}
else {
    $updateBody = @{
        name           = $UserName
        role           = $UserRole
        workspace      = $workspace.id
        employeeId     = $EmployeeId
        customerId     = $CustomerId
        supplierId     = $SupplierId
        pushExternalId = $PushExternalId
        canSwitchRoles = $CanSwitchRoles
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

Write-Host "Bootstrap listo."
Write-Host ("Workspace: {0} ({1})" -f $bootstrap.workspaceSlug, $bootstrap.workspaceId)
Write-Host ("Usuario Fideo: {0}" -f $UserEmail)
