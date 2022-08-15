# 仕様

## Slackのデータの取得

下記の理由でメッセージの取得をSlackWebAPIからではなく、エクスポートデータから参照する仕様となっています  

- メッセージの総数によってはAPIを叩く回数が膨大になり、データの完全性を保証しにくい
- APIのクォータやレスポンスを考慮してページネーションで再起的にAPIを叩く必要があり、その処理やそれに伴うデータ取得失敗時のリトライ処理などの不安定になりそうな実装をできるだけ排除したい
- メッセージにユーザー名の情報が含まれない <span style="color:crimson;">※1</span>

<span style="color:crimson;">※1</span> Slack APIの[conversations.history](https://api.slack.com/methods/conversations.history)で取得したメッセージは、ユーザー情報がユーザーIDのみで、ユーザー名が含まれず、取得するためのオプションが無いため、別途ユーザー名を取得する必要があります  

ただし、Bot情報だけはSlackWebAPIから取得しています  
エクスポートデータの`users.json`のBotIdとメッセージに記載されているBotIdがなぜか違うためです  
[bots.info](https://api.slack.com/methods/bots.info)や[users.info](https://api.slack.com/methods/users.info)のどちらのBotIdで取得しても、updatedが1時間ほど違うだけでそれ以外の情報は同じで、BotIdが2つある理由は不明です  
そのため、エクスポートデータだけではBotIdが照合できないので、照合するためにSlackBot経由でSlackWebAPIからBot情報を取得しています  

## Discordへの移行設定のオプション

Discordへの移行する際のオプションとして、下記のオプションがあります  

- メッセージ内のメンションなどに含まれるユーザ名の変更
- 移行したPrivateチャンネルへのユーザーの自動join

メッセージのデータを変換する前に、変換したユーザーのデータファイル`.migtation/user.json`に、DiscordのユーザーIDやユーザー名を手動で設定することで実行可能です  

## アーカイブされたチャンネルの移行

Discordにはチャンネルのアーカイブ機能がないため、アーカイブされたチャンネルはARCHIVEカテゴリーにまとめる仕様になっています  
それ以外のチャンネルはCHANNELカテゴリーにまとめる仕様です  
アーカイブされたチャンネルを移行しない場合は、`.env`ファイルのIS_MIGRATE_ARCHIVEの環境変数の値に「"false"」を設定し、  
`direnv allow`のコマンドを実行して環境変数の変更を反映してください  

## メッセージの形式

メッセージの最初の行は切り取り線、2行目には絵文字アイコン、ユーザー名(Bot名)、投稿日の情報が含まれます  
絵文字アイコンは「🤖」はBot、「🥶」は解約済みユーザー、「😃」はアクティブユーザーからのメッセージであることを示します  
