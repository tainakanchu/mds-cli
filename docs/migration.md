# 移行されるものと移行されないもの

## 移行されるもの

- Public/Privateチャンネルのメッセージの移行 <span style="color:crimson;">※1</span>
- アーカイブされたチャンネルのメッセージの移行
- メッセージの添付ファイルの移行
- リプライされたメッセージの移行
- 移行するメッセージ内のメンションなどに含まれるユーザ名の変更　<span style="color:crimson;">※2</span>
- 移行するPrivateチャンネルへのユーザーの自動join　<span style="color:crimson;">※3</span>

<span style="color:crimson;">※1</span> Slackのビジネスプラス以上のプランでのみ、Privateチャンネルを含めた全てのチャンネルのエクスポートが可能です  
Slackは[後からPrivateチャンネル→Publicチャンネルに変更できない](https://slack.com/intl/ja-jp/help/articles/213185467-%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%82%92%E3%83%97%E3%83%A9%E3%82%A4%E3%83%99%E3%83%BC%E3%83%88%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%81%AB%E5%A4%89%E6%8F%9B%E3%81%99%E3%82%8B)ため、実質的にSlackのプロ以下のプランではPrivateチャンネルのエクスポートができません  
Privateチャンネルを含めた全てのチャンネルのエクスポートを行うためには、[ワークスペースのオーナーの権限が必要](https://slack.com/intl/ja-jp/help/articles/204897248-Slack-%E3%81%AE%E3%82%A4%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%88-%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%81%AE%E6%89%8B%E6%AE%B5)です  

<span style="color:crimson;">※2</span> `.migtation/user.json`に、Discordのユーザー名を手動で設定する必要があります

<span style="color:crimson;">※3</span> `.migtation/user.json`に、DiscordのユーザーIDを手動で設定する必要があります

## 移行されないもの

- SlackBotの移行
- SlackのDM(ダイレクトメッセージ)の移行
- Discordのユーザーの自動作成
