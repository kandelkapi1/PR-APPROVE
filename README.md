# Slack PR Auto-Approve Bot 🤖

A Slack bot that automatically approves GitHub Pull Requests when someone sends you a PR link as a direct message.

## Features

- ✅ Auto-approves PRs sent via DM
- ✅ Auto-approves PRs when @mentioned
- ✅ 1 second delay before approval (as requested)
- ✅ Supports multiple PRs in a single message
- ✅ Visual feedback with emoji reactions
- ✅ Thread replies for confirmation

## How It Works

1. Someone sends you a DM with a GitHub PR link
2. Bot reacts with 👀 to show it's processing
3. After 1 second delay, bot approves the PR
4. Bot reacts with ✅ and replies with confirmation

## Setup Instructions

### 1. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it (e.g., "PR Auto-Approve Bot") and select your workspace

### 2. Configure Bot Permissions

Go to **OAuth & Permissions** and add these **Bot Token Scopes**:

```
channels:history      - View messages in public channels
chat:write           - Send messages
groups:history       - View messages in private channels
im:history           - View direct messages
im:write             - Send direct messages
mpim:history         - View group direct messages
reactions:read       - View emoji reactions
reactions:write      - Add emoji reactions
app_mentions:read    - View @mentions
```

### 3. Enable Socket Mode

1. Go to **Socket Mode** in the left sidebar
2. Toggle **Enable Socket Mode** to ON
3. Create an App-Level Token with `connections:write` scope
4. Save the token (starts with `xapp-`)

### 4. Enable Events

Go to **Event Subscriptions**:

1. Toggle **Enable Events** to ON
2. Under **Subscribe to bot events**, add:
   - `message.im` (Direct messages)
   - `app_mention` (When someone @mentions the bot)

### 5. Install App to Workspace

1. Go to **Install App** in the left sidebar
2. Click **Install to Workspace**
3. Authorize the app
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 6. Create GitHub Token

1. Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` (for private repositories)
   - OR `public_repo` (for public repositories only)
4. Generate and copy the token

### 7. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your tokens:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
GITHUB_TOKEN=ghp_your-github-token
```

### 8. Install Dependencies & Run

```bash
npm install
npm start
```

## Usage

### Direct Message
Send a DM to the bot with a PR link:
```
Hey, can you approve this? https://github.com/owner/repo/pull/123
```

### @Mention in Channel
Mention the bot in any channel:
```
@PR-Bot please approve https://github.com/owner/repo/pull/123
```

### Multiple PRs
You can send multiple PRs in one message:
```
Please approve these:
https://github.com/owner/repo/pull/123
https://github.com/owner/repo/pull/456
```

## Project Structure

```
slack-pr-bot/
├── src/
│   └── app.js          # Main bot application
├── package.json        # Dependencies
├── .env.example        # Environment template
└── README.md           # This file
```

## Troubleshooting

### Bot not responding to DMs
- Ensure `im:history` scope is added
- Make sure `message.im` event is subscribed
- Check Socket Mode is enabled

### "Can't approve PR" errors
- Verify GitHub token has correct scopes
- Ensure you have permission to approve the PR
- Check if the PR is still open

### Finding your Slack User ID
1. Click your profile picture in Slack
2. Click **Profile**
3. Click **More** (⋮)
4. Click **Copy member ID**

## Security Notes

⚠️ **Important**: This bot will approve ANY PR sent to it. Consider adding:

- Allowlist of repositories
- Allowlist of users who can request approvals
- Approval confirmation before acting

Example modification for repo allowlist:

```javascript
const ALLOWED_REPOS = ['owner/repo1', 'owner/repo2'];

// In approvePR function:
if (!ALLOWED_REPOS.includes(`${owner}/${repo}`)) {
    return { success: false, error: 'Repository not in allowlist' };
}
```

## License

MIT
