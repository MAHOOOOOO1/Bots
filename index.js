const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, AttachmentBuilder, ActivityType, SlashCommandBuilder, REST, Routes, MessageFlags } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = 'MTU1NTE0NjU0Njc0Njc1NzE5MQ.G5z8KF.9iaZQAMjdYOMfhhw4eYYQNn7ITZHJuehmbH6cM';
const ALLOWED_CHANNEL_ID = '1555151671208968253';
const LOG_CHANNEL_ID = '1555234068830883982';
const AUTO_ROLE_ID = '1554937300767739904';
const TARGET_USER_IDS = ['1253010387515736134', '977452314275217438'];

const badWords = [
    "sik", "orospu", "amk", "aq", "amq", "piç", "pic", 
    "kahpe", "yavşak", "ibne", "amcık", "yarrak", "taşak", "tasak",
    "oc", "o.ç", "oç", "anan", "anani", "annani", "ananın", "ananin",
    "bacin", "bacini", "bacının", "sikeyim", "sikiyim", "siktim",
    "amina", "amına", "göt", "goc", "orosbu", "amını", "sikerim"
];

const userWarnings = new Map();
const ticketTranscripts = new Map();
let deletedMessagesLog = [];
const userMessageTracker = new Map();

async function sendLog(guild, title, description, color = 0x2b2d31, files = []) {
    try {
        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
        
        await logChannel.send({ embeds: [embed], files: files });
    } catch (err) {}
}

client.once('clientReady', async () => {
    client.user.setPresence({
        activities: [{
            name: "Discord Café'de sohbet ediyor",
            type: ActivityType.Playing,
            timestamps: { start: Date.now() }
        }],
        status: 'dnd'
    });

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const commands = [
        new SlashCommandBuilder()
            .setName('sil')
            .setDescription('Bulunduğunuz kanaldaki belirtilen miktarda mesajı siler.')
            .addIntegerOption(option =>
                option.setName('sayi')
                    .setDescription('Silinecek mesaj sayısı (1-100)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            )
    ];

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) {}

    console.log(`${client.user.tag} aktif ve hazır.`);
});

client.on('guildMemberAdd', async member => {
    try {
        await member.roles.add(AUTO_ROLE_ID);
        await sendLog(member.guild, "Oto Rol Verildi", `Yeni üye olan <@${member.id}> kullanıcısına otomatik rol verildi.`, 0x3498db);
    } catch (err) {}
});

client.on('messageDelete', async message => {
    if (!message.guild) return;

    const authorTag = message.author ? message.author.tag : "Bilinmeyen Kullanıcı";
    const authorId = message.author ? message.author.id : "Bilinmeyen ID";
    const content = message.content ? message.content : "[İçerik önbellekte yok veya görsel/dosya]";

    const logEntry = `[${new Date().toLocaleString()}] Kanal: #${message.channel.name} | Yazan: ${authorTag} (${authorId}) | Mesaj: ${content}`;
    deletedMessagesLog.push(logEntry);

    if (deletedMessagesLog.length >= 100) {
        for (const userId of TARGET_USER_IDS) {
            try {
                const user = await client.users.fetch(userId);
                if (user) {
                    const buffer = Buffer.from(deletedMessagesLog.join('\n'), 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: `silinen-mesajlar-100.txt` });
                    
                    await user.send({
                        content: `Sunucuda toplam **100 adet** mesaj silindi. Arşiv dosyası ektedir:`,
                        files: [attachment]
                    });
                }
            } catch (err) {}
        }
        deletedMessagesLog = [];
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'sil') {
            if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.', flags: MessageFlags.Ephemeral });
            }

            const count = interaction.options.getInteger('sayi');
            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const deleted = await interaction.channel.bulkDelete(count, true);
                
                deleted.forEach(msg => {
                    const tag = msg.author ? msg.author.tag : "Bilinmeyen";
                    const text = msg.content || "[İçerik yok]";
                    deletedMessagesLog.push(`[${new Date().toLocaleString()}] Kanal: #${interaction.channel.name} | Yazan: ${tag} | Mesaj: ${text}`);
                });

                if (deletedMessagesLog.length >= 100) {
                    for (const userId of TARGET_USER_IDS) {
                        try {
                            const user = await client.users.fetch(userId);
                            if (user) {
                                const buffer = Buffer.from(deletedMessagesLog.join('\n'), 'utf-8');
                                const attachment = new AttachmentBuilder(buffer, { name: `silinen-mesajlar-100.txt` });
                                await user.send({ content: `Sunucuda toplu silme işlemiyle 100 mesaja ulaşıldı:`, files: [attachment] });
                            }
                        } catch (e) {}
                    }
                    deletedMessagesLog = [];
                }

                await interaction.editReply({ content: `Başarıyla **${deleted.size}** adet mesaj silindi.` });
                await sendLog(interaction.guild, "Mesajlar Silindi", `Kanal: <#${interaction.channel.id}>\nYetkili: <@${interaction.user.id}>\nSilinen Mesaj Sayısı: ${deleted.size}`, 0xe74c3c);
            } catch (err) {
                await interaction.editReply({ content: 'Mesajlar silinirken bir hata oluştu (14 günden eski mesajlar toplu silinemez).' });
            }
        }
        return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket_btn') {
        const guild = interaction.guild;
        const categoryName = "🎫 Biletler";

        let category = guild.channels.cache.find(c => c.name === categoryName && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory
            });
        }

        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;

        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]
            });

            ticketTranscripts.set(ticketChannel.id, [`Bilet: #${ticketChannel.name}`, `Açan: ${interaction.user.tag} (${interaction.user.id})`, `Tarih: ${new Date().toLocaleString()}\n`]);

            await interaction.reply({ content: `Biletiniz açıldı: ${ticketChannel}`, flags: MessageFlags.Ephemeral });

            const embed = new EmbedBuilder()
                .setTitle("☕ Discord Café Destek")
                .setDescription(`Merhaba <@${interaction.user.id}>, destek talebin açıldı.\n\nSorununu detaylıca yazabilirsin.`)
                .setColor(0x2b2d31)
                .setImage("https://cdn.discordapp.com/attachments/1555135279432597535/1555144658068176946/banner_kucuk.gif?ex=6abf74d3&is=6abe2353&hm=2b66de9a940def0dec0544e82bc33451aa55d18eb165d87aaaef22f9d25fbb41&");

            const closeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket_btn')
                        .setLabel('🔒 Bileti Kapat')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({ embeds: [embed], components: [closeRow] });
            await sendLog(guild, "Bilet Açıldı", `Açan: <@${interaction.user.id}>\nKanal: #${ticketChannel.name}`, 0x2ecc71);

        } catch (error) {
            await interaction.reply({ content: 'Bir hata oluştu.', flags: MessageFlags.Ephemeral });
        }
    }

    if (interaction.customId === 'close_ticket_btn') {
        const channelId = interaction.channel.id;
        await interaction.reply({ content: 'Bilet kapatılıyor...', flags: MessageFlags.Ephemeral });

        let attachment = null;
        if (ticketTranscripts.has(channelId)) {
            const logs = ticketTranscripts.get(channelId);
            logs.push(`\nBilet kapatıldı.`);
            const buffer = Buffer.from(logs.join('\n'), 'utf-8');
            attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });
            ticketTranscripts.delete(channelId);
        }

        await sendLog(
            interaction.guild, 
            "Bilet Kapatıldı", 
            `Kanal: #${interaction.channel.name}\nKapatan: <@${interaction.user.id}>`, 
            0xe74c3c, 
            attachment ? [attachment] : []
        );

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (err) {}
        }, 4000);
    }
});

client.on('messageCreate', async message => {
    if (!message.guild || !message.member) return;

    if (message.content === '!m' || message.content === '!log') {
        if (!TARGET_USER_IDS.includes(message.author.id)) {
            return message.reply('Bu komutu sadece yetkili kullanıcılar kullanabilir.');
        }

        if (deletedMessagesLog.length === 0) {
            return message.reply('Şu anda hafızada kayıtlı silinen mesaj bulunmuyor.');
        }

        try {
            const user = await client.users.fetch(message.author.id);
            const buffer = Buffer.from(deletedMessagesLog.join('\n'), 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `silinen-mesajlar-arsiv.txt` });
            
            await user.send({
                content: `İstediğin silinen mesajlar dosyası (${deletedMessagesLog.length} adet):`,
                files: [attachment]
            });
            await message.reply('Silinen mesajlar özel mesajlarına (DM) gönderildi!');
        } catch (err) {
            message.reply('DM gönderilemedi. Lütfen özel mesaj kutunun açık olduğundan emin ol.');
        }
        await message.delete().catch(() => {});
        return;
    }

    if (message.author.bot) return;

    if (message.content === '!kurulum') {
        if (message.channel.id !== ALLOWED_CHANNEL_ID) {
            return message.reply(`Bu komut sadece <#${ALLOWED_CHANNEL_ID}> kanalında kullanılabilir.`).then(msg => {
                setTimeout(() => msg.delete(), 4000);
            });
        }

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Yönetici yetkin olmalı.');
        }

        const embed = new EmbedBuilder()
            .setTitle("☕ Discord Café - Destek Sistemi")
            .setDescription("Destek talebi açmak için aşağıdaki butona tıklayın.")
            .setColor(0x2b2d31);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_btn')
                    .setLabel('🎫 Bilet Oluştur')
                    .setStyle(ButtonStyle.Success)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await sendLog(message.guild, "Kurulum Yapıldı", `Yetkili: <@${message.author.id}>`);
        await message.delete().catch(() => {});
        return;
    }

    if (message.content.startsWith('!lock')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Yönetici yetkin olmalı.');
        }

        const targetChannel = message.mentions.channels.first() || message.channel;

        try {
            await targetChannel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });

            const lockEmbed = new EmbedBuilder()
                .setTitle("Kanal Kilitlendi")
                .setDescription(`${targetChannel} kanalı kilitlendi.`)
                .setColor(0xe74c3c);

            await targetChannel.send({ embeds: [lockEmbed] });
            await sendLog(message.guild, "Kanal Kilitlendi", `Kanal: ${targetChannel}\nYetkili: <@${message.author.id}>`);
            await message.delete().catch(() => {});
        } catch (error) {
            message.reply('Hata oluştu.');
        }
        return;
    }

    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        const logLine = `[${new Date().toLocaleTimeString()}] ${message.author.tag}: ${message.content}`;
        if (ticketTranscripts.has(message.channel.id)) {
            ticketTranscripts.get(message.channel.id).push(logLine);
        }
    }

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const userId = message.author.id;
        const now = Date.now();
        
        if (!userMessageTracker.has(userId)) {
            userMessageTracker.set(userId, []);
        }
        const timestamps = userMessageTracker.get(userId);
        timestamps.push(now);
        
        const recentMessages = timestamps.filter(time => now - time < 3000);
        userMessageTracker.set(userId, recentMessages);

        if (recentMessages.length > 4) {
            await message.delete().catch(() => {});
            try {
                const member = await message.guild.members.fetch(userId);
                await member.timeout(10 * 60 * 1000, "Flood / Spam yaptığı için 10 dakika susturuldu.");
                const spamWarn = await message.channel.send(`<@${userId}>, çok hızlı mesaj atıyorsun (Flood/Spam), 10 dakika süreyle susturuldun!`);
                setTimeout(() => spamWarn.delete().catch(() => {}), 5000);
                await sendLog(message.guild, "Flood / Spam Susturması", `Kullanıcı: <@${userId}> çok hızlı mesaj attığı için 10 dk mute yedi.`, 0xe74c3c);
            } catch (err) {}
            return;
        }

        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|discord\.[a-z]{2,}\/[^\s]+|[a-z0-9]+\.[a-z]{2,}\/[^\s]+)/i;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            const warnMsg = await message.channel.send(`<@${userId}>, bu sunucuda link paylaşmak yasaktır!`);
            setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
            await sendLog(message.guild, "Link Engellendi", `Kullanıcı: <@${userId}>\nKanal: <#${message.channel.id}>\nMesaj: ${message.content}`, 0xe74c3c);
            return;
        }

        const rawContent = message.content.toLowerCase();
        const normalizedContent = rawContent.replace(/[^a-zçğıöşü]/g, '');

        const words = rawContent.split(/\s+/);
        const hasWordMatch = words.some(w => badWords.includes(w));
        const hasSubstringMatch = badWords.some(bad => normalizedContent.includes(bad));

        if (hasWordMatch || hasSubstringMatch) {
            await message.delete().catch(() => {});

            let count = userWarnings.get(userId) || 0;
            count++;
            userWarnings.set(userId, count);

            if (count < 3) {
                const warnEmbed = new EmbedBuilder()
                    .setTitle("Küfür / Argo Algılandı")
                    .setDescription(`<@${userId}>, küfür veya argo içeren kelimeler kullanmak yasaktır. Uyarı: ${count}/3`)
                    .setColor(0xf1c40f);

                const warnMsg = await message.channel.send({ embeds: [warnEmbed] });
                setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

                await sendLog(message.guild, "Küfür Uyarısı Verildi", `Kullanıcı: <@${userId}>\nUyarı: ${count}/3\nMesaj: ${message.content}`, 0xf1c40f);
            } else {
                try {
                    const member = await message.guild.members.fetch(userId);
                    await member.timeout(24 * 60 * 60 * 1000, "3 kez küfür ettiği için 1 gün süreyle mutelendi.");
                    
                    userWarnings.set(userId, 0);

                    const muteEmbed = new EmbedBuilder()
                        .setTitle("Susturuldu")
                        .setDescription(`<@${userId}> 3 küfür uyarı sınırını aştığı için 1 gün süreyle susturuldu.`)
                        .setColor(0xe74c3c);

                    const muteMsg = await message.channel.send({ embeds: [muteEmbed] });
                    setTimeout(() => muteMsg.delete().catch(() => {}), 6000);

                    await sendLog(message.guild, "Mute Atıldı", `Kullanıcı: <@${userId}> 3 uyarıyı aştığı için 1 gün susturuldu.`, 0xe74c3c);
                } catch (err) {}
            }
            return;
        }
    }
});

client.login(TOKEN);
