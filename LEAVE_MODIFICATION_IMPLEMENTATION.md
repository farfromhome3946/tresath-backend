# Leave Management - Date Overlap Validation & Modification System

## Summary of Changes

### 1. **Date Overlap Validation** ✅
- **Status**: Already implemented in the backend API
- **Location**: `app/api/leave/route.ts` - `overlap()` function
- **How it works**:
  - Checks for overlapping dates before creating or modifying leave records
  - Returns HTTP 409 (Conflict) status with error message
  - Error message: "These dates overlap an existing leave record. You cannot be on leave twice; please enter the correct dates."
  - Applied to both initial leave requests (POST) and amendments (PATCH)

### 2. **Enhanced UI Components**

#### A. Leave Type Definition
- Added `Amendment` type to track leave modification requests
- Updated `Leave` type to include optional `amendment` field
- Allows frontend to display amendment status and details

#### B. Availed Component (Personnel View)
**New Features**:
- **Edit Button**: "Modify leave" button appears on approved leaves without pending amendments
- **Amendment Request Form**: 
  - Personnel can request to modify their leave dates (e.g., early recall)
  - Form collects new from date, to date, return date, and days
  - Error handling for overlapping dates with user-friendly messages
- **Amendment Status Display**:
  - Shows pending amendment details below the original leave record
  - Displays amendment status (PENDING, SDM_APPROVED, ADJT_APPROVED, APPROVED, REJECTED)
- **Loading States**: Submit button shows "Saving..." or "Requesting..." during operations
- **Error Messages**: Clear red alert boxes for failed submissions

#### C. LeaveBoard Component (SDM/Adjutant View)
**New Features**:
- **Two Sections**:
  1. **Pending Amendment Requests** (Priority section with orange/yellow theme)
     - Shows personnel with recalled/modified leave requests
     - Displays original dates vs. requested dates
     - Shows approval status from SDM and Adjutant
  2. **Pending Leave Requests** (Standard approval section)
     - Shows leave requests awaiting initial approval

- **Amendment Approval Workflow**:
  - Both SDM and Adjutant can independently approve/reject amendments
  - Check marks indicate who has approved
  - Becomes fully approved when both have approved
  - Modifications are rejected if dates still overlap another leave record

### 3. **Workflow: Leave Modification for Early Recall**

```
Personnel → Modify Leave Dates → Amendment Request Sent to SDM & Adjutant
                                           ↓
                                    SDM Reviews & Approves ✓
                                    Adjutant Reviews & Approves ✓
                                           ↓
                        Amendment Approved - Dates Updated
                        (or Rejected if dates overlap)
```

### 4. **Error Handling**
- **Overlapping Dates**: User gets immediate feedback with clear message
- **Invalid Dates**: Form validates date relationships (to date must be after from date, etc.)
- **Network Errors**: "Unable to connect to server" message
- **Insufficient Balance**: Checked during amendment (balance impact changes with new days)
- **Permission Errors**: Only approved leaves without pending amendments can be modified

### 5. **Backend API Integration**

**Existing Endpoints Used**:
- **POST /api/leave** - Create new leave request
  - Includes overlap validation
  - Returns error 409 if dates conflict

- **PATCH /api/leave** - Update leave (approval, rejection, amendments)
  - Action: `request_amendment` - Personnel request to modify dates
  - Action: `approve_amendment` / `reject_amendment` - SDM/Adjutant decisions
  - Validates amended dates don't overlap other approved leaves
  - Adjusts leave balance if days change
  - Requires both SDM and ADJT approval for final amendment approval

### 6. **Visual Indicators**

**Leave History**:
- ✅ Status badge (Approved/Pending/Rejected)
- 📝 Edit button (only on approved leaves)
- ⏳ Amendment status shown below original dates

**Amendment Requests (LeaveBoard)**:
- 🔔 Separate highlighted section with orange/yellow theme
- ✓ SDM approval indicator
- ✓ Adjutant approval indicator
- 📅 Shows both original and requested dates side-by-side

### 7. **User Messages**

**For Personnel**:
- "These dates overlap an existing leave record. You cannot be on leave twice; please enter the correct dates."
- "Request leave modification for early recall" (prompt when editing)
- "Send to SDM & Adjutant" (button text for submitting amendment)

**For SDM/Adjutant**:
- "Personnel recalled early requesting to adjust their leave dates. Both SDM and Adjutant approval required."
- Status shows who has approved: "✓ SDM · Adjutant" or "✓ SDM · ✓ Adjutant"

## Files Modified

1. **app/page.tsx**
   - Updated `Leave` and `Amendment` type definitions
   - Enhanced `Availed` component with edit/amendment functionality
   - Enhanced `LeaveBoard` component with amendment request display

## Testing Checklist

- [ ] Personnel can fill leave dates
- [ ] Overlap validation prevents conflicting dates with error message
- [ ] Personnel can edit approved leaves to request amendments
- [ ] Amendment form appears with original dates pre-filled
- [ ] SDM and Adjutant can see pending amendment requests
- [ ] Both SDM and Adjutant can approve/reject amendments
- [ ] Amendment dates are validated for overlaps
- [ ] Approved amendments update the leave dates
- [ ] Leave balance adjusts if days change after amendment
- [ ] Rejected amendments show in history
