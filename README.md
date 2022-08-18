# MSD CLI

<img src="./docs//img/msd.png" style="margin-left:auto; margin-right:auto; width:200px; display:block;">

SlackからDiscordにチャンネルのメッセージを移行するためのnode.js製のCLI  
MSDは(Migrate from Slack to Discord)の略称  

> **Warning**  
> このCLIは簡易的に作ったもののため、十分にテストされていません  
> 将来的にSlackやDiscordのAPIの仕様変更によって、使用できなくなる可能性があります  
> 動作の保証ができないので、利用する際は自己責任でお願いします  

SlackのエクスポートデータをDiscordに出力できるデータに変換し、DiscordBot経由でチャンネルの作成とメッセージの出力を行うことで移行します  

```mermaid
%%{init:{'theme':'dark','themeCSS':" .node rect {fill:#fff;} label {font-size:20px; font-weight:bold; color:#000} .output {font-size:36px;} img {background-color:#fff; weight:50px; height:50px;}"}}%%
flowchart LR
  msd(<img src='./docs/img/msd.png' /><br><label>MSD CLI</label>)
  slack(<img src='./docs/img/slack.png' /><br><label>Slack</label>)
  discord(<img src='./docs/img/discord.png' /><br><label>Discord</label>)
  slackBot(<img src='./docs/img/slack-bot.png' /><br><label>SlackBot</label>)
  discordBot(<img src='./docs/img/discord-bot.png' /><br><label>DiscordBot</label>)
  exportFile(<img src='./docs/img/slack-file.png' /><br><label>Export File</label>)
  migrationFile(<img src='./docs/img/discord-file.png' /><br><label>Migration File</label>)

  msd <--> |Migrate discord| discordBot
  discordBot <--> discord
  msd <--> |Check bot info| slackBot
  slackBot <--> slack
  exportFile --> |Get slack data| msd
  msd <--> |Convert slack data| migrationFile
```

## ドキュメント

- [移行されるものと移行されないもの](./docs/migration.md)
- [仕様](./docs/specification.md)
- [初回設定](./docs/init.md)
- [参考リンク](./docs/reference.md)

## 使用方法

[初回設定](./docs/initial-setting.md)を完了後、下記のコマンドを順次実行して移行します  

```zsh
# チャンネル、ユーザー、メッセージの移行ファイルを作成する
npm run build
# or
npm run init
npm run build:user
npm run build:message
npm run deploy:channel

# チャンネル、メッセージを作成する
npm run deploy
# or
npm run deploy:channel
npm run deploy:message
```

移行した内容を元に戻す場合は、下記のコマンドを実行することでリセットできます  

```zsh
# チャンネル、メッセージを削除する
npm run destroy
# or
npm run destroy:channel
npm run destroy:message
```

## License

[MIT](https://opensource.org/licenses/MIT)
