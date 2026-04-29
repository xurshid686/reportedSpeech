const fetch = require('node-fetch');

const UPSTASH_URL = process.env.UPSTASH_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testData = req.body;

    // Save to Upstash Redis for global leaderboard
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const timestamp = Date.now();
        const entry = JSON.stringify({
          name: testData.name || 'Anonymous',
          score: testData.score || 0,
          rating: testData.rating || 0,
          timestamp: timestamp,
          date: new Date(timestamp).toLocaleString()
        });
        const upstashRes = await fetch(`${UPSTASH_URL}/LPUSH/leaderboard_entries`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ args: [entry] })
        });
        // Trim leaderboard to top 100 entries
        await fetch(`${UPSTASH_URL}/LTRIM/leaderboard_entries/0/99`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ args: [] })
        });
      } catch (e) {
        console.error('Upstash error:', e.message);
      }
    }

    // Send Telegram report
    if (BOT_TOKEN && PRIVATE_CHAT_ID) {
      try {
        const privateMessage = createPrivateReport(testData);
        await sendTelegramMessage(BOT_TOKEN, PRIVATE_CHAT_ID, privateMessage);
      } catch (e) {
        console.error('Telegram private error:', e.message);
      }
    }
    if (BOT_TOKEN && GROUP_CHAT_ID) {
      try {
        const groupMessage = createGroupReport(testData);
        await sendTelegramMessage(BOT_TOKEN, GROUP_CHAT_ID, groupMessage);
      } catch (e) {
        console.error('Telegram group error:', e.message);
      }
    }

    res.status(200).json({ success: true, message: 'Results submitted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit results: ' + error.message });
  }
};

async function sendTelegramMessage(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const parts = splitMessage(message);
  for (const part of parts) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: part, parse_mode: 'HTML' })
    });
    await new Promise(r => setTimeout(r, 100));
  }
}

function splitMessage(msg, max = 4096) {
  if (msg.length <= max) return [msg];
  const parts = [];
  while (msg.length > max) {
    let splitAt = msg.lastIndexOf('\n', max);
    if (splitAt === -1) splitAt = max;
    parts.push(msg.slice(0, splitAt));
    msg = msg.slice(splitAt + 1);
  }
  if (msg) parts.push(msg);
  return parts;
}

function createPrivateReport(d) {
  const q = d.questions || [];
  let msg = `<b>Reported Speech Quiz Report</b>\n\n`;
  msg += `<b>Student:</b> ${d.name || 'Anonymous'}\n`;
  msg += `<b>Score:</b> ${d.score}/${q.length} (${d.percentage || 0}%)\n`;
  msg += `<b>Time:</b> ${d.time || 'N/A'}\n`;
  msg += `<b>Rating:</b> ${d.rating || 0}/5 stars\n\n`;
  msg += `<b>Question Details:</b>\n`;
  q.forEach((item, i) => {
    msg += `<b>Q${i+1}:</b> ${item.question ? item.question.slice(0,50)+'...' : 'N/A'}\n`;
    msg += `User: ${item.userAnswer || 'N/A'} | Correct: ${item.correctAnswer || 'N/A'} | ${item.isCorrect ? '✅' : '❌'}\n\n`;
  });
  const pct = d.percentage || 0;
  if (pct >= 90) msg += `<b>Performance:</b> Excellent! Outstanding work!`;
  else if (pct >= 75) msg += `<b>Performance:</b> Very Good! Keep it up!`;
  else if (pct >= 50) msg += `<b>Performance:</b> Good. More practice needed.`;
  else msg += `<b>Performance:</b> Needs improvement. Keep practicing!`;
  return msg;
}

function createGroupReport(d) {
  return `<b>Quiz Result</b>\nStudent: ${d.name || 'Anonymous'}\nScore: ${d.score}/${(d.questions || []).length} (${d.percentage || 0}%)\nRating: ${d.rating || 0}/5`;
}
