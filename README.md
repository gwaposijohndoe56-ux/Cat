# BLADE//QUEUE — Firebase live request system

This package contains two separate interfaces that share one Firebase Realtime Database:

- `index.html` — public, read-only streamer display. No login is required.
- `moderator.html` — moderator control room. Email/password login is required.
- `shared.js` — shared Firebase setup, live listeners, and atomic queue operations.
- `database.rules.json` — Realtime Database security rules.
- `firebase.json` and `.firebaserc` — optional Firebase Hosting configuration for this project.

## 1. Add the Realtime Database URL

The config supplied for the Firebase web app did not contain a Realtime Database URL. Open Firebase Console → **Realtime Database** → **Data** and copy the database URL shown above the data tree.

Open `shared.js` and replace:

```js
databaseURL: "PASTE_REALTIME_DATABASE_URL_HERE",
```

with the exact URL from the console, for example the URL shape shown by Firebase itself. Do not guess the region or database name. Keep the quotation marks.

The API key, app ID, and project settings you supplied have already been added to `shared.js`. Analytics is not needed for the queue to work.

## 2. Enable moderator email/password login

In Firebase Console:

1. Open **Authentication** → **Sign-in method**.
2. Enable **Email/Password**.
3. Open **Users** and add the moderator account(s) with an email and password.
4. Copy each moderator user's **UID**. Do not put the password in any HTML file.

There is intentionally no public sign-up form.

## 3. Publish the database rules

Open Realtime Database → **Rules**, replace the rules with the contents of `database.rules.json`, and click **Publish**.

These rules make the `/queue` data publicly readable for the stream display, but writable only by a signed-in Firebase user whose UID has been approved under `/moderators`. A user cannot approve themselves through this website because client writes to `/moderators` are denied.

## 4. Approve each moderator UID

In Realtime Database → **Data**, create this structure for every moderator UID copied in step 2:

```json
{
  "moderators": {
    "PASTE_MODERATOR_UID_HERE": true
  }
}
```

Replace the example key with the actual UID. You can add multiple UID entries. The Firebase Console owner can create this data even though website clients cannot edit the `/moderators` path.

The moderator page checks the signed-in user's own UID entry before showing the control panel. The rules independently enforce the same check on every database write.

## 5. Host the files

Keep `index.html`, `moderator.html`, and `shared.js` in the same folder and publish them together on the same HTTPS website. The module imports and Firebase web APIs should be served from a web server; opening the HTML directly as a `file://` file may be blocked by browser module/CORS rules.

Firebase Hosting is already configured for this project. From this folder, with the Firebase CLI installed and authenticated, run:

```bash
firebase deploy --only hosting
```

Alternatively, upload the three website files to your existing static HTTPS host. The rules JSON and README are setup files; they do not need to be public.

## 6. Use it on two devices

- Open the public `index.html` URL on the streamer's computer or streaming device. It is read-only and designed for fullscreen display.
- Open the `moderator.html` URL on the moderator's phone. Sign in with the approved email/password account.
- When the moderator adds, edits, reorders, completes, skips, or deletes a request, Firebase Realtime Database pushes the updated queue to the stream display automatically.

## Included behavior

- Current challenger is the first active request and is visually highlighted.
- Requests join the back of the line by default.
- Completed and skipped requests move into history.
- Completing the first request automatically promotes the next request.
- Duplicate active requests are blocked using an atomic database transaction.
- Moderator can edit, reorder, complete, skip, or delete requests.
- Stream page shows remaining count, completed count, connection state, new-request animation, and completed history.
- Queue operations use Firebase Realtime Database transactions so simultaneous moderator actions do not silently overwrite one another.

## Data layout

```text
/
  queue/
    waiting/
      <requestId>/
        blader
        beyblade
        ratchet
        bit
        fullCombo
        note
        createdAt
        position
    completed/
      <requestId>/
        ...request fields
        status       // "completed" or "skipped"
        completedAt
    updatedAt
  moderators/
    <firebase-auth-uid>: true
```

## Important notes

- The stream page intentionally exposes the waiting list and completed history to anyone who has its URL. That is how a no-login public display works. Do not put private information in request notes.
- Only approved moderator accounts can modify the queue, and the restriction is enforced by Firebase Security Rules, not merely by hiding buttons.
- Use a strong unique password for each moderator account. Remove a moderator's `/moderators/<uid>` entry to revoke their queue access; also disable/delete their Firebase Authentication account if they should no longer sign in.
- The Firebase web API key is a client identifier, not a database password. Security comes from Authentication and the Realtime Database rules.
