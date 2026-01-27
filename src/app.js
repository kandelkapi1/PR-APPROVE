require('dotenv').config();

const { App } = require('@slack/bolt');
const { Octokit } = require('@octokit/rest');

// Initialize Slack app
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

// // Allowed Channel ID - only members of this channel can get PRs approved
// const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID || '';

// // Cache for channel members (refreshes every 5 minutes)
// let allowedUsers = [];
// let lastFetch = 0;
// const CACHE_DURATION = 5 * 60 * 1000;

// Regex to match GitHub PR URLs
const PR_URL_REGEX = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/g;

// /**
//  * Fetch members of the allowed channel
//  */
// async function fetchChannelMembers(client) {
//     const now = Date.now();
    
//     if (allowedUsers.length > 0 && (now - lastFetch) < CACHE_DURATION) {
//         return allowedUsers;
//     }

//     if (!ALLOWED_CHANNEL_ID) {
//         console.log('No ALLOWED_CHANNEL_ID set');
//         return [];
//     }

//     try {
//         const result = await client.conversations.members({
//             channel: ALLOWED_CHANNEL_ID,
//         });
        
//         allowedUsers = result.members || [];
//         lastFetch = now;
//         console.log(`Fetched ${allowedUsers.length} members from channel`);
//         return allowedUsers;
//     } catch (error) {
//         console.error(`Failed to fetch channel members: ${error.message}`);
//         return allowedUsers;
//     }
// }

// /**
//  * Check if a user is in the allowed channel
//  */
// async function isUserAllowed(client, userId) {
//     const members = await fetchChannelMembers(client);
//     return members.includes(userId);
// }

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
 * Listen for DMs to the bot
 */
app.message(async ({ message, client }) => {
    // Only process direct messages
    if (message.channel_type !== 'im') {
        return;
    }

    const userId = message.user;
    const text = message.text || '';

    // // Check if user is a member of the allowed channel
    // const isAllowed = await isUserAllowed(client, userId);
    // if (!isAllowed) {
    //     return;
    // }

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
        try {
            await client.reactions.add({
                channel: message.channel,
                timestamp: message.ts,
                name: result.success ? 'white_check_mark' : 'x',
            });
        } catch (e) {
            // Ignore reaction errors
        }
    }
});

// Start the app
(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ Slack PR Auto-Approve Bot is running!`);
    console.log(`Accepting PRs from: ANYONE who DMs the bot`);
})();