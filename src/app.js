require('dotenv').config();

const { App } = require('@slack/bolt');
const { Octokit } = require('@octokit/rest');

// Initialize Slack app with BOTH bot and user tokens
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
});

// Initialize GitHub client
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

// Your Slack User ID - to identify your DMs
const OWNER_USER_ID = process.env.OWNER_USER_ID || '';

// User token for reacting in your DMs
const USER_TOKEN = process.env.SLACK_USER_TOKEN || '';

// Allowed Channel ID - PRs posted in this channel will be auto-approved
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID || '';

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Regex to match GitHub PR URLs
const PR_URL_REGEX = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/g;

/**
 * Extract PR information from a GitHub PR URL
 */
function extractPRInfo(url) {
    const match = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/.exec(url);
    if (match) {
        return {
            owner: match[1],
            repo: match[2],
            pull_number: parseInt(match[3], 10),
        };
    }
    return null;
}

/**
 * Approve a GitHub PR (no comment)
 */
async function approvePR(owner, repo, pull_number) {
    try {
        await octokit.pulls.createReview({
            owner,
            repo,
            pull_number,
            event: 'APPROVE',
        });
        return { success: true };
    } catch (error) {
        console.error(`Failed to approve PR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Add reaction to a message using appropriate token
 */
async function addReaction(channel, timestamp, emoji, isUserDM = false) {
    try {
        if (isUserDM && USER_TOKEN) {
            // Use user token for reactions in user's DMs
            const { WebClient } = require('@slack/web-api');
            const userClient = new WebClient(USER_TOKEN);
            await userClient.reactions.add({
                channel: channel,
                timestamp: timestamp,
                name: emoji,
            });
        } else {
            // Use bot token
            await app.client.reactions.add({
                channel: channel,
                timestamp: timestamp,
                name: emoji,
            });
        }
    } catch (e) {
        // Ignore reaction errors
    }
}

/**
 * Process a message for PR URLs and approve them
 */
async function processMessageForPRs(message, channel, isUserDM = false) {
    const text = message.text || '';
    const userId = message.user;
    const messageKey = `${channel}-${message.ts}`;

    // Skip if already processed
    if (processedMessages.has(messageKey)) {
        return;
    }
    processedMessages.add(messageKey);

    // Clean up old processed messages (keep last 1000)
    if (processedMessages.size > 1000) {
        const arr = Array.from(processedMessages);
        arr.slice(0, 500).forEach(key => processedMessages.delete(key));
    }

    const prUrls = text.match(PR_URL_REGEX);

    if (!prUrls || prUrls.length === 0) {
        return;
    }

    const uniquePrUrls = [...new Set(prUrls)];

    for (const prUrl of uniquePrUrls) {
        const prInfo = extractPRInfo(prUrl);

        if (!prInfo) {
            continue;
        }

        console.log(`Processing PR from user ${userId}: ${prInfo.owner}/${prInfo.repo}#${prInfo.pull_number}`);

        // Wait 1 second before approving
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await approvePR(prInfo.owner, prInfo.repo, prInfo.pull_number);

        // React with ✅ on success, ❌ on failure
        await addReaction(
            channel,
            message.ts,
            result.success ? 'white_check_mark' : 'x',
            isUserDM
        );

        console.log(`PR ${prInfo.owner}/${prInfo.repo}#${prInfo.pull_number}: ${result.success ? 'APPROVED ✅' : 'FAILED ❌'}`);
    }
}

/**
 * Listen for ALL message events (including user's DMs via Events API)
 */
app.event('message', async ({ event, client }) => {
    // Skip bot messages
    if (event.bot_id || event.subtype === 'bot_message') {
        return;
    }

    const channelType = event.channel_type;
    const channelId = event.channel;
    const userId = event.user;

    let shouldProcess = false;
    let isUserDM = false;

    // DM to the bot
    if (channelType === 'im') {
        // Check if this is a DM to the bot OR a DM to the owner (you)
        // Events API will send both if configured correctly
        shouldProcess = true;
        
        // If the message is not FROM the owner and we're receiving it,
        // it's either a DM to bot OR we have user events enabled for owner's DMs
        if (OWNER_USER_ID && userId !== OWNER_USER_ID) {
            isUserDM = true; // Might be a DM to the owner
        }
    }

    // Group DM
    if (channelType === 'mpim') {
        shouldProcess = true;
    }

    // Allowed channel
    if (ALLOWED_CHANNEL_ID && channelId === ALLOWED_CHANNEL_ID) {
        shouldProcess = true;
    }

    if (!shouldProcess) {
        return;
    }

    await processMessageForPRs(event, channelId, isUserDM);
});

// Start the app
(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);

    console.log(`⚡️ Slack PR Auto-Approve Bot is running!`);
    console.log(`Processing PRs from:`);
    console.log(`  - Anyone who DMs the bot directly`);
    console.log(`  - Anyone in a group DM (mpim) with the bot`);
    if (ALLOWED_CHANNEL_ID) {
        console.log(`  - Anyone posting in channel: ${ALLOWED_CHANNEL_ID}`);
    }
    if (OWNER_USER_ID) {
        console.log(`  - Anyone who DMs you (${OWNER_USER_ID}) via Events API`);
    }
    console.log(`\n📋 Make sure you've configured your Slack app with the required event subscriptions!`);
})();