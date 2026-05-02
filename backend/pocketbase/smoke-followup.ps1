[CmdletBinding()]
param(
    [string]$AppUrl = "http://127.0.0.1:8090",
    [string]$SuperuserEmail = "dev@fideo.local",
    [string]$SuperuserPassword = "ChangeMe123!",
    [string]$UserEmail = "smoke.followup@fideo.local",
    [string]$UserPassword = "ChangeMe123!",
    [string]$UserName = "Smoke Follow Up",
    [string]$WorkspaceSlug = "smoke-followup",
    [string]$WorkspaceName = "Fideo Smoke Follow Up",
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)

    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
}

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

function Copy-JsonValue {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [string] -or $Value -is [ValueType]) {
        return $Value
    }

    $json = $Value | ConvertTo-Json -Depth 50 -Compress
    return $json | ConvertFrom-Json
}

function Get-SnapshotArray {
    param(
        [object]$Snapshot,
        [string]$FieldName
    )

    $value = Get-RecordValue -Record $Snapshot -FieldName $FieldName
    if ($null -eq $value) {
        return ,@()
    }

    $items = @(Copy-JsonValue -Value $value)
    if ($items.Count -eq 1 -and $null -eq $items[0]) {
        return ,@()
    }

    return ,$items
}

function Find-SnapshotItemById {
    param(
        [object]$Snapshot,
        [string]$FieldName,
        [string]$Id
    )

    foreach ($item in (Get-SnapshotArray -Snapshot $Snapshot -FieldName $FieldName)) {
        if ([string](Get-RecordValue -Record $item -FieldName "id") -eq $Id) {
            return $item
        }
    }

    return $null
}

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
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
        $params["Body"] = ($Body | ConvertTo-Json -Depth 50 -Compress)
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $statusCode = 0
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        catch {}

        $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $_.ErrorDetails.Message
        }
        else {
            $_.Exception.Message
        }

        throw "PocketBase $Method $Path failed ($statusCode): $detail"
    }
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

    throw "PocketBase did not respond at $AppUrl after $TimeoutSeconds seconds."
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
        -Headers $Headers `
        -Body $null

    $items = @($response.items)
    if ($items.Count -eq 0) {
        return $null
    }

    return $items[0]
}

function Get-RecordCount {
    param(
        [string]$CollectionName,
        [string]$Filter,
        [hashtable]$Headers
    )

    $query = [uri]::EscapeDataString($Filter)
    $response = Invoke-PocketBaseJson `
        -Method "Get" `
        -Path ("/api/collections/{0}/records?page=1&perPage=1&filter={1}" -f $CollectionName, $query) `
        -Headers $Headers `
        -Body $null

    return [int](Get-RecordValue -Record $response -FieldName "totalItems")
}

function Invoke-Bootstrap {
    param([string]$Token)

    return Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/fideo/bootstrap" `
        -Headers @{
            Authorization = "Bearer $Token"
        } `
        -Body @{
            workspaceSlug = $WorkspaceSlug
            workspaceName = $WorkspaceName
            seedSnapshot  = @{
                employees       = @()
                taskAssignments = @()
                taskReports     = @()
                activityLog     = @()
            }
        }
}

function Invoke-Persist {
    param(
        [string]$Token,
        [string]$WorkspaceId,
        [int]$ExpectedVersion,
        [object]$SnapshotPatch
    )

    return Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/fideo/state/persist" `
        -Headers @{
            Authorization = "Bearer $Token"
        } `
        -Body @{
            workspaceId     = $WorkspaceId
            expectedVersion = $ExpectedVersion
            snapshot        = $SnapshotPatch
        }
}

function Invoke-FollowUp {
    param(
        [string]$Token,
        [string]$WorkspaceId,
        [int]$ExpectedVersion,
        [string]$TaskId,
        [string]$Summary,
        [string]$Detail
    )

    return Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/fideo/exceptions/follow-up" `
        -Headers @{
            Authorization = "Bearer $Token"
        } `
        -Body @{
            workspaceId     = $WorkspaceId
            expectedVersion = $ExpectedVersion
            exceptionId     = "task_blocked:$TaskId"
            taskId          = $TaskId
            target          = "responsible"
            summary         = $Summary
            detail          = $Detail
            createReport    = $true
            markEscalated   = $true
        }
}

Write-Step "Waiting for PocketBase health."
Wait-ForPocketBase

Write-Step "Authenticating superuser."
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

Write-Step "Ensuring smoke workspace exists."
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
elseif ([string](Get-RecordValue -Record $workspace -FieldName "name") -ne $WorkspaceName) {
    $workspace = Invoke-PocketBaseJson `
        -Method "Patch" `
        -Path ("/api/collections/fideo_workspaces/records/{0}" -f $workspace.id) `
        -Headers $superuserHeaders `
        -Body @{
            name = $WorkspaceName
            slug = $WorkspaceSlug
        }
}

Write-Step "Ensuring smoke user exists and is bound to the workspace."
$appUser = Find-FirstRecord `
    -CollectionName "fideo_users" `
    -Filter ("email = {0}" -f (ConvertTo-FilterLiteral -Value $UserEmail)) `
    -Headers $superuserHeaders

$userBody = @{
    email           = $UserEmail
    password        = $UserPassword
    passwordConfirm = $UserPassword
    name            = $UserName
    role            = "Admin"
    workspace       = $workspace.id
    canSwitchRoles  = $true
    verified        = $true
}

if (-not $appUser) {
    $appUser = Invoke-PocketBaseJson `
        -Method "Post" `
        -Path "/api/collections/fideo_users/records" `
        -Headers $superuserHeaders `
        -Body $userBody
}
else {
    $appUser = Invoke-PocketBaseJson `
        -Method "Patch" `
        -Path ("/api/collections/fideo_users/records/{0}" -f $appUser.id) `
        -Headers $superuserHeaders `
        -Body $userBody
}

Write-Step "Authenticating smoke app user."
$appUserAuth = Invoke-PocketBaseJson `
    -Method "Post" `
    -Path "/api/collections/fideo_users/auth-with-password" `
    -Body @{
        identity = $UserEmail
        password = $UserPassword
    }

$appToken = [string]$appUserAuth.token
$workspaceId = ""
$restorePatch = $null
$restoreCompleted = $false
$stateMutated = $false
$smokeTaskId = ""
$smokeNoteReportId = ""
$smokeEmployeeId = ""
$originalActivityCount = 0

try {
    Write-Step "Bootstrapping current state."
    $bootstrapBefore = Invoke-Bootstrap -Token $appToken
    $workspaceId = [string]$bootstrapBefore.workspaceId
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($workspaceId)) -Message "Bootstrap did not return a workspaceId."

    $originalEmployees = Get-SnapshotArray -Snapshot $bootstrapBefore.snapshot -FieldName "employees"
    $originalTasks = Get-SnapshotArray -Snapshot $bootstrapBefore.snapshot -FieldName "taskAssignments"
    $originalReports = Get-SnapshotArray -Snapshot $bootstrapBefore.snapshot -FieldName "taskReports"
    $originalActivityLog = Get-SnapshotArray -Snapshot $bootstrapBefore.snapshot -FieldName "activityLog"
    $originalActivityCount = $originalActivityLog.Count

    $restorePatch = @{
        employees       = @($originalEmployees)
        taskAssignments = @($originalTasks)
        taskReports     = @($originalReports)
        activityLog     = @($originalActivityLog)
    }

    $runId = [guid]::NewGuid().ToString("N").Substring(0, 12)
    $nowIso = (Get-Date).ToUniversalTime().ToString("o")
    $smokeEmployeeId = "smoke-employee-$runId"
    $smokeTaskId = "smoke-task-$runId"
    $taskTitle = "Smoke Follow Up Task $runId"
    $followUpSummary = "Smoke follow-up summary $runId"
    $followUpDetail = "Smoke follow-up detail $runId"
    $smokeEmployee = @{
        id   = $smokeEmployeeId
        name = "Smoke Rider $runId"
        role = "Repartidor"
    }
    $smokeTask = @{
        id            = $smokeTaskId
        taskId        = $smokeTaskId
        role          = "Repartidor"
        employeeId    = $smokeEmployeeId
        employeeName  = "Smoke Rider $runId"
        title         = $taskTitle
        customerName  = "Cliente Smoke"
        status        = "blocked"
        assignedAt    = $nowIso
        blockedAt     = $nowIso
        updatedAt     = $nowIso
        blockedReason = "Synthetic blocker for smoke."
        payload       = @{
            source = "smoke-followup.ps1"
        }
    }

    $persistEmployees = [System.Collections.ArrayList]::new()
    foreach ($item in @($originalEmployees)) {
        [void]$persistEmployees.Add($item)
    }
    [void]$persistEmployees.Add($smokeEmployee)

    $persistTasks = [System.Collections.ArrayList]::new()
    foreach ($item in @($originalTasks)) {
        [void]$persistTasks.Add($item)
    }
    [void]$persistTasks.Add($smokeTask)

    $persistReports = [System.Collections.ArrayList]::new()
    foreach ($item in @($originalReports)) {
        [void]$persistReports.Add($item)
    }

    $persistPatch = @{
        employees       = @($persistEmployees)
        taskAssignments = @($persistTasks)
        taskReports     = @($persistReports)
        activityLog = @($originalActivityLog)
    }

    Write-Step "Persisting compact synthetic task snapshot."
    $persistResult = Invoke-Persist `
        -Token $appToken `
        -WorkspaceId $workspaceId `
        -ExpectedVersion ([int]$bootstrapBefore.version) `
        -SnapshotPatch $persistPatch

    $stateMutated = $true

    $taskCount = Get-RecordCount `
        -CollectionName "fideo_task_assignments" `
        -Filter ("workspace = {0} && externalId = {1}" -f (ConvertTo-FilterLiteral -Value $workspaceId), (ConvertTo-FilterLiteral -Value $smokeTaskId)) `
        -Headers $superuserHeaders
    Assert-Condition -Condition ($taskCount -eq 1) -Message "Synthetic task was not materialized after persist."

    Write-Step "Sending follow-up over the persisted exception."
    $followUpResult = Invoke-FollowUp `
        -Token $appToken `
        -WorkspaceId $workspaceId `
        -ExpectedVersion ([int]$persistResult.version) `
        -TaskId $smokeTaskId `
        -Summary $followUpSummary `
        -Detail $followUpDetail

    $smokeNoteReportId = [string](Get-RecordValue -Record $followUpResult.noteReport -FieldName "id")
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($smokeNoteReportId)) -Message "Follow-up did not create the expected note report."
    Assert-Condition -Condition ([string](Get-RecordValue -Record $followUpResult -FieldName "followUpTarget") -eq "responsible") -Message "Follow-up target was not persisted as responsible."
    Assert-Condition -Condition ([int](Get-RecordValue -Record $followUpResult.taskAssignment -FieldName "followUpCount") -ge 1) -Message "Task follow-up count was not incremented."

    Write-Step "Re-bootstrapping to verify persisted follow-up state."
    $bootstrapAfterFollowUp = Invoke-Bootstrap -Token $appToken
    Assert-Condition -Condition ([int]$bootstrapAfterFollowUp.version -eq [int]$followUpResult.version) -Message "Bootstrap version did not match follow-up version."

    $taskAfterFollowUp = Find-SnapshotItemById -Snapshot $bootstrapAfterFollowUp.snapshot -FieldName "taskAssignments" -Id $smokeTaskId
    $noteAfterFollowUp = Find-SnapshotItemById -Snapshot $bootstrapAfterFollowUp.snapshot -FieldName "taskReports" -Id $smokeNoteReportId

    Assert-Condition -Condition ($null -ne $taskAfterFollowUp) -Message "Synthetic task did not survive re-bootstrap."
    Assert-Condition -Condition ($null -ne $noteAfterFollowUp) -Message "Follow-up note report did not survive re-bootstrap."
    Assert-Condition -Condition ([int](Get-RecordValue -Record $taskAfterFollowUp -FieldName "followUpCount") -ge 1) -Message "Task follow-up metadata was lost after re-bootstrap."
    Assert-Condition -Condition ([string](Get-RecordValue -Record $taskAfterFollowUp -FieldName "lastFollowUpTarget") -eq "responsible") -Message "Task lastFollowUpTarget was not restored by bootstrap."
    Assert-Condition -Condition ((Get-SnapshotArray -Snapshot $bootstrapAfterFollowUp.snapshot -FieldName "activityLog").Count -eq ($originalActivityCount + 1)) -Message "Follow-up activity log entry was not persisted."

    $noteCountAfterFollowUp = Get-RecordCount `
        -CollectionName "fideo_task_reports" `
        -Filter ("workspace = {0} && externalId = {1}" -f (ConvertTo-FilterLiteral -Value $workspaceId), (ConvertTo-FilterLiteral -Value $smokeNoteReportId)) `
        -Headers $superuserHeaders
    Assert-Condition -Condition ($noteCountAfterFollowUp -eq 1) -Message "Follow-up note report was not materialized after re-bootstrap."

    Write-Step "Restoring original compact snapshot slices."
    $restoreResult = Invoke-Persist `
        -Token $appToken `
        -WorkspaceId $workspaceId `
        -ExpectedVersion ([int]$bootstrapAfterFollowUp.version) `
        -SnapshotPatch $restorePatch

    $restoreCompleted = $true

    Write-Step "Re-bootstrapping after restore to verify cleanup."
    $bootstrapAfterRestore = Invoke-Bootstrap -Token $appToken
    Assert-Condition -Condition ([int]$bootstrapAfterRestore.version -eq [int]$restoreResult.version) -Message "Bootstrap version did not match restore version."
    Assert-Condition -Condition ($null -eq (Find-SnapshotItemById -Snapshot $bootstrapAfterRestore.snapshot -FieldName "employees" -Id $smokeEmployeeId)) -Message "Synthetic employee still exists after restore."
    Assert-Condition -Condition ($null -eq (Find-SnapshotItemById -Snapshot $bootstrapAfterRestore.snapshot -FieldName "taskAssignments" -Id $smokeTaskId)) -Message "Synthetic task still exists after restore."
    Assert-Condition -Condition ($null -eq (Find-SnapshotItemById -Snapshot $bootstrapAfterRestore.snapshot -FieldName "taskReports" -Id $smokeNoteReportId)) -Message "Follow-up note report still exists after restore."
    Assert-Condition -Condition ((Get-SnapshotArray -Snapshot $bootstrapAfterRestore.snapshot -FieldName "activityLog").Count -eq $originalActivityCount) -Message "Activity log count did not return to its original value after restore."
    Assert-Condition -Condition ((Get-SnapshotArray -Snapshot $bootstrapAfterRestore.snapshot -FieldName "taskReports").Count -eq $originalReports.Count) -Message "Task report count did not return to its original value after restore."

    $taskCountAfterRestore = Get-RecordCount `
        -CollectionName "fideo_task_assignments" `
        -Filter ("workspace = {0} && externalId = {1}" -f (ConvertTo-FilterLiteral -Value $workspaceId), (ConvertTo-FilterLiteral -Value $smokeTaskId)) `
        -Headers $superuserHeaders
    Assert-Condition -Condition ($taskCountAfterRestore -eq 0) -Message "Synthetic task record still exists in normalized storage after restore."

    $noteCountAfterRestore = Get-RecordCount `
        -CollectionName "fideo_task_reports" `
        -Filter ("workspace = {0} && externalId = {1}" -f (ConvertTo-FilterLiteral -Value $workspaceId), (ConvertTo-FilterLiteral -Value $smokeNoteReportId)) `
        -Headers $superuserHeaders
    Assert-Condition -Condition ($noteCountAfterRestore -eq 0) -Message "Synthetic follow-up note still exists in normalized storage after restore."

    Write-Step "Smoke passed."
    Write-Host ""
    Write-Host "WorkspaceId    : $workspaceId"
    Write-Host "WorkspaceSlug  : $WorkspaceSlug"
    Write-Host "SmokeTaskId    : $smokeTaskId"
    Write-Host "SmokeNoteId    : $smokeNoteReportId"
    Write-Host "RestoreVersion : $($restoreResult.version)"
}
finally {
    if ($stateMutated -and -not $restoreCompleted -and $restorePatch -and -not [string]::IsNullOrWhiteSpace($workspaceId)) {
        Write-Warning "Smoke failed before the normal restore path completed. Attempting best-effort cleanup."

        try {
            $latestBootstrap = Invoke-Bootstrap -Token $appToken
            $null = Invoke-Persist `
                -Token $appToken `
                -WorkspaceId $workspaceId `
                -ExpectedVersion ([int]$latestBootstrap.version) `
                -SnapshotPatch $restorePatch

            $bootstrapAfterCleanup = Invoke-Bootstrap -Token $appToken
            Assert-Condition -Condition ($null -eq (Find-SnapshotItemById -Snapshot $bootstrapAfterCleanup.snapshot -FieldName "taskAssignments" -Id $smokeTaskId)) -Message "Cleanup left the synthetic task in the snapshot."
            Assert-Condition -Condition ($null -eq (Find-SnapshotItemById -Snapshot $bootstrapAfterCleanup.snapshot -FieldName "taskReports" -Id $smokeNoteReportId)) -Message "Cleanup left the synthetic note report in the snapshot."
            Write-Warning "Best-effort cleanup completed."
        }
        catch {
            Write-Warning ("Best-effort cleanup failed: {0}" -f $_.Exception.Message)
        }
    }
}
