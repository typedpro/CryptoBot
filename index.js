const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const COINBASE_API_URL = 'https://api.coinbase.com/v2/accounts';
const API_KEY = process.env.COINBASE_API_KEY;
const API_SECRET = process.env.COINBASE_API_SECRET;

// Register slash command
const command = new SlashCommandBuilder()
  .setName('send')
  .setDescription('Send crypto to an address')
  .addStringOption(opt => opt.setName('mode').setDescription('Crypto type (e.g. LTC, USDT)').setRequired(true))
  .addStringOption(opt => opt.setName('to').setDescription('Receiver wallet address').setRequired(true))
  .addNumberOption(opt => opt.setName('amount').setDescription('Amount to send').setRequired(true));

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [command.toJSON()] });
    console.log('Slash command registered');
  } catch (err) {
    console.error(err);
  }
})();

client.on('ready', () => console.log(`Bot logged in as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'send') {
    const mode = interaction.options.getString('mode').toUpperCase();
    const to = interaction.options.getString('to');
    const amount = interaction.options.getNumber('amount');

    await interaction.deferReply();

    try {
      // 1. Get account ID for the selected currency
      const accountRes = await axios.get(COINBASE_API_URL, {
        headers: {
          'CB-ACCESS-KEY': API_KEY,
          'CB-ACCESS-SIGN': '', // Coinbase Advanced API needs signing for production, see docs
          'CB-VERSION': '2023-07-22'
        }
      });

      const account = accountRes.data.data.find(acc => acc.currency === mode);

      if (!account) {
        return await interaction.editReply(`❌ Could not find a ${mode} wallet.`);
      }

      const accountId = account.id;

      // 2. Send crypto
      const sendRes = await axios.post(`https://api.coinbase.com/v2/accounts/${accountId}/transactions`, {
        type: "send",
        to: to,
        amount: amount.toString(),
        currency: mode
      }, {
        headers: {
          'CB-ACCESS-KEY': API_KEY,
          'CB-VERSION': '2023-07-22'
        }
      });

      const data = sendRes.data.data;

      const response = `**Crypto Transaction**

**Mode:** ${mode}  
**Amount Sent:** ${amount}

Sent on: ${new Date().toLocaleDateString()}  
Payment went through: ✅ Yes

**Receiver:** ${to}`;

      await interaction.editReply(response);
    } catch (err) {
      console.error(err.response?.data || err);
      await interaction.editReply('❌ Failed to send transaction. Double-check wallet, currency, and amount.');
    }
  }
});

client.login(TOKEN);
