const fetch = require('node-fetch');

// Telegram Bot Configuration - REPLACE WITH YOUR ACTUAL TOKENS AND CHAT IDs
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID || 'YOUR_PRIVATE_CHAT_ID';
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || 'YOUR_GROUP_CHAT_ID';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const testData = req.body;

        // Send detailed report to private chat
        const privateMessage = createPrivateReport(testData);
        await sendTelegramMessage(PRIVATE_CHAT_ID, privateMessage);

        // Send short report to group chat
        const groupMessage = createGroupReport(testData);
        await sendTelegramMessage(GROUP_CHAT_ID, groupMessage);

        res.status(200).json({ 
            success: true, 
            message: 'Results submitted successfully' 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit results' 
        });
    }
};

async function sendTelegramMessage(chatId, message) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        })
    });

    if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
    }

    return response.json();
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
