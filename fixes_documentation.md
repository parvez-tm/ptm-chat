# Bug Fixes & Improvements — PTM Chat

## Overview

This document catalogs all bugs identified during the code review and the fixes applied across the **backend** and **frontend** codebases. A total of **17 fixes** were made across **16 files**.

---

## Backend Fixes (10 fixes)

### 1. Timestamp Typo in Mongoose Schemas

**Files:**
- `backend/src/routes/permission/permission-model.js`
- `backend/src/routes/user-permission/user-permission-model.js`

**Problem:**
Both schemas had `timestaps: true` (missing the second `m`), which meant Mongoose was **not** auto-generating `createdAt` and `updatedAt` fields for Permission and UserPermission documents.

**Before:**
```javascript
{ timestaps: true }
```

**After:**
```javascript
{ timestamps: true }
```

**Impact:** Permission and UserPermission documents now correctly receive `createdAt` and `updatedAt` timestamps.

---

### 2. Unprotected User Routes

**File:** `backend/src/routes/user/user-api.js`

**Problem:**
Three user endpoints had no authentication middleware:
- `POST /user/addUser` — anyone could create users
- `PUT /user/updateUser/:id` — anyone could modify user data
- `DELETE /user/deleteUser/:id` — anyone could delete users

**Before:**
```javascript
router.post('/addUser', profileImage.single('profileImage'), addUser);
router.put('/updateUser/:id', id_checker_middleware, profileImage.single('profileImage'), updateUser);
router.delete('/deleteUser/:id', id_checker_middleware, deleteUser);
```

**After:**
```javascript
router.post('/addUser', token_middleware, profileImage.single('profileImage'), addUser);
router.put('/updateUser/:id', token_middleware, id_checker_middleware, profileImage.single('profileImage'), updateUser);
router.delete('/deleteUser/:id', token_middleware, id_checker_middleware, deleteUser);
```

**Impact:** All user mutation endpoints now require a valid JWT token.

---

### 3. Hard Delete Instead of Soft Delete

**File:** `backend/src/routes/user/user-controller.js` — `deleteUser()`

**Problem:**
`deleteUser` used `findByIdAndDelete()` which permanently removed the user document. This broke referential integrity — messages and conversations referencing that user would have dangling references. It also contradicted the `isDeleted` field on the User model.

**Before:**
```javascript
const data = await User.findByIdAndDelete(_id);
```

**After:**
```javascript
const user = await User.findById(_id);
if (!user || user.isDeleted) {
    return res.status(404).json({ message: 'No User Found' });
}
user.isDeleted = true;
await user.save();
```

**Impact:** Users are now soft-deleted. Chat history and conversation references remain intact.

---

### 4. Duplicate Login Endpoint

**Files:**
- `backend/src/routes/user/user-api.js`
- `backend/src/routes/user/user-controller.js`

**Problem:**
Two separate login endpoints existed:
- `POST /auth/login` (auth-controller.js) — full implementation with refresh tokens, Redis online status
- `POST /user/login` (user-controller.js) — stale implementation, no refresh token, no Redis integration, used callback-style `jwt.sign()`

**Fix:** Removed the duplicate `login` export from `user-controller.js` and the `POST /user/login` route from `user-api.js`. The canonical login is `POST /auth/login`.

**Impact:** Single login endpoint, no confusion, consistent token handling.

---

### 5. Input Sanitizer Not Working

**Files:**
- `backend/src/services/sanitize-service.js`
- `backend/src/routes/user/user-controller.js`
- `backend/package.json`

**Problem (3 issues):**
1. `sanitizeData()` was imported but **commented out** at both call sites in `user-controller.js`
2. The sanitizer used `dompurify`, which is a **browser-only** library — it requires a `window` / DOM object that doesn't exist in Node.js
3. `dompurify` would crash at runtime in the Node.js backend

**Fix:**
- Rewrote `sanitize-service.js` to use a server-side HTML tag stripper (regex-based `<[^>]*>` removal + trim)
- Enabled sanitization in both `addUser` and `updateUser` by uncommenting the calls
- Removed `dompurify` from `package.json` dependencies

**Before (user-controller.js):**
```javascript
let data = JSON.parse(req.body.data)
// let data = sanitizeData(body)
```

**After:**
```javascript
let body = JSON.parse(req.body.data)
let data = sanitizeData(body)
```

**Impact:** All user input is now sanitized before database writes, preventing XSS injection via stored HTML content.

---

### 6. Admin Middleware Returns 500 Instead of 403

**File:** `backend/src/middleware/admin-middleware.js`

**Problem:**
When a non-admin user attempted to access an admin-only route, the middleware returned HTTP 500 (Server Error) instead of 403 (Forbidden). Also contained a debug `console.log(req.user)` that leaked user data to server logs.

**Before:**
```javascript
console.log(req.user);
if (req.user.roleId != 1) {
    return res.status(500).json({ message: "You don't have permission to access the data " });
}
```

**After:**
```javascript
if (req.user.roleId != 1) {
    return res.status(403).json({ message: "You don't have permission to access the data" });
}
```

**Impact:** Correct HTTP semantics, no data leakage in logs.

---

### 7. Deleted Users Still Returned in Queries

**File:** `backend/src/routes/user/user-controller.js` — `getAllUsers()`, `getUserById()`

**Problem:**
- `getAllUsers()` returned all users including soft-deleted ones (`isDeleted: true`)
- `getUserById()` returned soft-deleted users
- Both endpoints returned sensitive fields (`password`, `refreshToken`)

**Fix:**
- Added `isDeleted: false` filter to the default query in `parseRequestParams()` and to `getUserById()`
- Added `.select('-password -refreshToken')` to both query paths

**Impact:** Soft-deleted users are invisible via API. No credentials leak in responses.

---

### 8. Dead Commented-Out Code Cleanup

**File:** `backend/src/routes/user/user-controller.js`

**Problem:** ~70 lines of commented-out legacy `getAllUsers` code was left in the file.

**Fix:** Removed the dead code block entirely.

**Impact:** Cleaner codebase, reduced file size.

---

### 9. Read Receipts — Stale Redis Cache

**Files:**
- `backend/src/socket/socket.js`
- `backend/src/routes/message/message-controller.js`

**Problem:**
When messages were marked as read (via Socket.IO `messageRead` event or REST `PUT /message/read/:conversationId`), the `readBy` field was updated in MongoDB but the **Redis message cache was never invalidated**. Since page 1 of messages is served from the Redis cache (within the 1-hour TTL), users would see stale `readBy` data — all messages appeared as "sent" (single check) instead of "read" (double check) even after the other participant had read them.

**Fix:** Added `await redisClient.del(\`chat:${conversationId}:messages\`)` after updating `readBy` in both code paths:

**socket.js — `messageRead` handler:**
```javascript
await Message.updateMany(...);
// NEW: Invalidate Redis message cache so next fetch gets fresh readBy
await redisClient.del(`chat:${conversationId}:messages`);
```

**message-controller.js — `markAsRead()`:**
```javascript
await Message.updateMany(...);
// NEW: Invalidate Redis message cache so next fetch gets fresh readBy
await redisClient.del(`chat:${conversationId}:messages`);
```

**Impact:** Read receipts now correctly reflect the actual `readBy` state from MongoDB. The cache is rebuilt on the next fetch.

---

### 10. Read Receipts — Reader's Local State Never Synced

**File:** `backend/src/socket/socket.js`

**Problem:**
The Socket.IO `messageRead` handler used `socket.to(room).emit('messagesRead', ...)` which broadcasts to everyone in the room **except the emitting socket** (the reader). This meant the reader's local `readBy` array was never updated with their own ID. As a result, the ChatWindow `useEffect` that detects unread messages would repeatedly find the same messages as "unread" and re-emit `messageRead` events on every render cycle — causing an infinite loop of socket emissions.

**Before:**
```javascript
// Only sends to others — reader never gets the event
socket.to(`conversation:${conversationId}`).emit('messagesRead', ...);
```

**After:**
```javascript
// Sends to ALL participants including the reader for local state sync
io.to(`conversation:${conversationId}`).emit('messagesRead', ...);
```

**Impact:** The reader's local state is updated immediately, the unread detection stops re-firing, and the sender sees the double-check marks in real-time.

---

## Frontend Fixes (7 fixes)

### 11. Chat History Pagination Missing

**Files:**
- `frontend/src/pages/ChatPage.jsx`
- `frontend/src/components/ChatWindow.jsx`
- `frontend/src/components/ChatWindow.css`

**Problem:**
The frontend only ever fetched the first page of messages (`GET /message/:id` with no `?page=` param). There was no way to load older messages despite the backend supporting full pagination.

**Fix:**
- Added `page`, `hasMore`, and `loadingMessages` state to `ChatPage`
- `fetchMessages()` now accepts a `pageNum` parameter and passes `?page=N` to the API
- New `loadOlderMessages()` callback increments page when more exist
- `ChatWindow` now detects scroll-to-top and calls `onLoadMore`
- Shows a "Load older messages" button and a spinner during loading
- Preserves scroll position when older messages are prepended (prevents jump to top)

**New Props on ChatWindow:**
```jsx
<ChatWindow
    hasMore={hasMore}
    loadingMore={loadingMessages}
    onLoadMore={loadOlderMessages}
/>
```

**Impact:** Users can now scroll up to load full chat history page by page.

---

### 12. Read Receipts Not Updating in Real-Time

**File:** `frontend/src/pages/ChatPage.jsx`

**Problem:**
The `messagesRead` socket event was listened to in `ChatWindow.jsx` but the handler was a no-op comment:
```javascript
const handleMessagesRead = ({ conversationId, readBy }) => {
    // Could update message read status in UI here
};
```
This meant read receipts (double-check marks) would only appear after a page reload.

**Fix:** Moved the `messagesRead` listener to `ChatPage.jsx` where it has access to `setMessages`, and implemented the state update:
```javascript
const handleMessagesRead = ({ conversationId, readBy, messageIds }) => {
    setMessages(prev =>
        prev.map(msg => {
            if (messageIds.includes(msg._id) && !msg.readBy?.includes(readBy)) {
                return { ...msg, readBy: [...(msg.readBy || []), readBy] };
            }
            return msg;
        })
    );
};
```

**Impact:** When the other user reads your messages, double-check marks appear immediately without refreshing.

---

### 13. Duplicate Messages in Chat

**File:** `frontend/src/pages/ChatPage.jsx`

**Problem:**
When receiving a `newMessage` socket event, the message was always appended to state without deduplication. Socket reconnections or race conditions could result in the same message appearing multiple times.

**Before:**
```javascript
setMessages(prev => [...prev, message]);
```

**After:**
```javascript
setMessages(prev => {
    if (prev.some(m => m._id === message._id)) return prev;
    return [...prev, message];
});
```

**Impact:** No more duplicate messages in the chat window.

---

### 14. Hardcoded Backend URL

**Files:**
- `frontend/src/utils/api.js`
- `frontend/src/context/SocketContext.jsx`

**Problem:**
`http://localhost:4400` was hardcoded in two files, making it impossible to deploy to a different environment without code changes.

**Fix:**
- `api.js` now reads `import.meta.env.VITE_API_URL` with `http://localhost:4400` as fallback
- `SocketContext.jsx` imports `API_BASE_URL` from `api.js` instead of hardcoding the URL
- Created `frontend/.env.example` documenting the variable

**Impact:** Backend URL can be configured per environment via `.env` file.

---

### 15. Auth Pages Accessible When Logged In

**Files:**
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/RegisterPage.jsx`

**Problem:**
An authenticated user could navigate to `/login` or `/register` and see the forms, which is a UX issue and potential security confusion point.

**Fix:** Added `useEffect` redirect in both pages:
```javascript
const { login, isAuthenticated } = useAuth();

useEffect(() => {
    if (isAuthenticated) navigate('/chat', { replace: true });
}, [isAuthenticated, navigate]);
```

**Impact:** Logged-in users are automatically redirected to `/chat`.

---

### 16. Typing Indicator Leaked Across Conversations

**File:** `frontend/src/components/ChatWindow.jsx`

**Problem:**
When switching between conversations, the `typingUsers` state was not cleared. If someone was typing in conversation A and you switched to conversation B, the typing indicator could briefly appear in the wrong conversation.

**Fix:** Added a cleanup effect:
```javascript
useEffect(() => {
    setTypingUsers({});
    isInitialLoadRef.current = true;
}, [conversation?._id]);
```

**Impact:** Typing indicators are scoped to the correct conversation.

---

### 17. Improved Auto-Scroll Behavior

**File:** `frontend/src/components/ChatWindow.jsx`

**Problem:**
Auto-scroll always fired on any message change, even when loading older messages (pagination prepend), which would jump the user to the bottom and lose their reading position.

**Fix:**
- Tracks whether user is near bottom of scroll container (within 150px)
- Only auto-scrolls on initial load or when new messages arrive at the bottom
- Uses `instant` scroll on first load, `smooth` on subsequent messages
- Scroll position is preserved when older messages are prepended

**Impact:** Natural scrolling behavior — new messages scroll down, loading history doesn't jump.

---

## Files Changed Summary

| File | Changes |
|---|---|
| `backend/src/routes/permission/permission-model.js` | Typo fix: `timestaps` → `timestamps` |
| `backend/src/routes/user-permission/user-permission-model.js` | Typo fix: `timestaps` → `timestamps` |
| `backend/src/routes/user/user-api.js` | Added `token_middleware` to 3 routes, removed duplicate `/login` route |
| `backend/src/routes/user/user-controller.js` | Removed duplicate `login`, soft delete, `isDeleted` filter, password exclusion, sanitizer enabled, dead code removed |
| `backend/src/middleware/admin-middleware.js` | 500 → 403 status code, removed `console.log` |
| `backend/src/services/sanitize-service.js` | Rewrote from DOMPurify (browser-only) to server-side HTML stripper |
| `backend/src/socket/socket.js` | Read receipts: invalidate Redis cache, use `io.to()` instead of `socket.to()` |
| `backend/src/routes/message/message-controller.js` | `markAsRead`: invalidate Redis cache after updating `readBy` |
| `backend/package.json` | Removed `dompurify` dependency |
| `frontend/src/utils/api.js` | Env variable for API URL |
| `frontend/src/context/SocketContext.jsx` | Uses shared `API_BASE_URL` instead of hardcoded URL |
| `frontend/src/pages/ChatPage.jsx` | Pagination, dedup, real-time read receipts, ref-based callbacks |
| `frontend/src/components/ChatWindow.jsx` | Scroll-to-top pagination, typing cleanup, smart auto-scroll |
| `frontend/src/components/ChatWindow.css` | Load-more indicator and spinner styles |
| `frontend/src/components/MessageInput.jsx` | Removed unused `onMessageSent` prop |
| `frontend/src/pages/LoginPage.jsx` | Auth redirect guard |
| `frontend/src/pages/RegisterPage.jsx` | Auth redirect guard |
| `frontend/.env.example` | New file — documents `VITE_API_URL` |
