const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const testData = req.body;

        // Telegram Bot Configuration - USE ENVIRONMENT VARIABLES
        const BOT_TOKEN = process.env.BOT_TOKEN;
        const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID;
        const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

        if (!BOT_TOKEN || !PRIVATE_CHAT_ID || !GROUP_CHAT_ID) {
            console.error('Missing environment variables');
            return res.status(500).json({ 
                error: 'Server configuration error: Missing Telegram credentials' 
            });
        }

        // Send detailed report to private chat
        const privateMessage = createPrivateReport(testData);
        await sendTelegramMessage(BOT_TOKEN, PRIVATE_CHAT_ID, privateMessage);

        // Send short report to group chat
        const groupMessage = createGroupReport(testData);
        await sendTelegramMessage(BOT_TOKEN, GROUP_CHAT_ID, groupMessage);

        res.status(200).json({ 
            success: true, 
            message: 'Results submitted successfully' 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit results: ' + error.message 
        });
    }
};

async function sendTelegramMessage(botToken, chatId, message) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    // Telegram has a message limit of 4096 characters, so we need to split long messages
    const messageParts = splitMessage(message);
    
    for (const part of messageParts) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: part,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`Telegram API error: ${result.description || response.status}`);
        }

        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

function splitMessage(message, maxLength = 4096) {
    if (message.length <= maxLength) {
        return [message];
    }

    const parts = [];
    const lines = message.split('\n');
    let currentPart = '';

    for (const line of lines) {
        if (currentPart.length + line.length + 1 > maxLength) {
            if (currentPart) {
                parts.push(currentPart);
                currentPart = line;
            } else {
                // Single line is too long, split by words
                const words = line.split(' ');
                currentPart = '';
                for (const word of words) {
                    if (currentPart.length + word.length + 1 > maxLength) {
                        parts.push(currentPart);
                        currentPart = word;
                    } else {
                        currentPart += (currentPart ? ' ' : '') + word;
                    }
                }
            }
        } else {
            currentPart += (currentPart ? '\n' : '') + line;
        }
    }

    if (currentPart) {
        parts.push(currentPart);
    }

    return parts;
}

function createPrivateReport(testData) {
    const timeFormatted = `${Math.floor(testData.timeSpent / 60)}:${(testData.timeSpent % 60).toString().padStart(2, '0')}`;
    const date = new Date(testData.timestamp).toLocaleString();
    
    let message = `📊 <b>DETAILED TEST REPORT - Reported Speech</b>\n\n`;
    message += `👤 <b>Student:</b> ${testData.studentName}\n`;
    message += `⏱️ <b>Time Spent:</b> ${timeFormatted}\n`;
    message += `📅 <b>Date:</b> ${date}\n\n`;
    message += `🎯 <b>Score:</b> ${testData.score}% (${testData.correctAnswers}/${testData.totalQuestions})\n\n`;
    
    message += `<b>QUESTION DETAILS:</b>\n`;
    message += `────────────────────\n`;
    
    testData.answers.forEach((result, index) => {
        const status = result.isCorrect ? '✅' : '❌';
        message += `\n<b>Q${index + 1}:</b> ${status}\n`;
        message += `<i>Direct:</i> ${result.directSpeech}\n`;
        message += `<i>Reported:</i> ${result.question}\n`;
        message += `<b>Student's Answer:</b> ${result.userAnswer || 'Not answered'}\n`;
        message += `<b>Correct Answer:</b> ${result.correctAnswer}\n`;
        message += `────────────────────\n`;
    });

    // Performance analysis
    message += `\n<b>PERFORMANCE ANALYSIS:</b>\n`;
    const percentage = testData.score;
    if (percentage >= 90) {
        message += `🏆 <b>Excellent!</b> Outstanding understanding of reported speech.\n`;
    } else if (percentage >= 75) {
        message += `👍 <b>Very Good!</b> Strong grasp with minor areas for improvement.\n`;
    } else if (percentage >= 60) {
        message += `📚 <b>Good!</b> Solid foundation, some practice needed.\n`;
    } else if (percentage >= 50) {
        message += `💡 <b>Fair.</b> Basic understanding, needs more practice.\n`;
    } else {
        message += `🔍 <b>Needs Improvement.</b> Review reported speech rules and practice more.\n`;
    }

    return message;
}

function createGroupReport(testData) {
    const timeFormatted = `${Math.floor(testData.timeSpent / 60)}:${(testData.timeSpent % 60).toString().padStart(2, '0')}`;
    
    let message = `📚 <b>Test Completed - Reported Speech</b>\n\n`;
    message += `👤 <b>Student:</b> ${testData.studentName}\n`;
    message += `🎯 <b>Score:</b> ${testData.correctAnswers}/${testData.totalQuestions}\n`;
    message += `⏱️ <b>Time:</b> ${timeFormatted}\n`;
    message += `📊 <b>Percentage:</b> ${testData.score}%`;

    return message;
}
