# 仕様

## Slackのデータの取得

下記の理由でメッセージの取得をSlackWebAPIからではなく、エクスポートデータから参照する仕様となっています  

- メッセージの総数によってはAPIを叩く回数が膨大になり、データの完全性を保証しにくい
- APIのクォータやレスポンスを考慮してページネーションで再起的にAPIを叩く必要があり、その処理やそれに伴うデータ取得失敗時のリトライ処理などの不安定になりそうな実装をできるだけ排除したい
- メッセージにユーザー名の情報が含まれない <span style="color:crimson;">※1</span>

<span style="color:crimson;">※1</span> Slack APIの[conversations.history](https://api.slack.com/methods/conversations.history)で取得したメッセージは、ユーザー情報がユーザーIDのみで、ユーザー名が含まれず、取得するためのオプションが無いため、別途ユーザー名を取得する必要があります  

ただし、Bot情報だけはSlackWebAPIから取得しています  
エクスポートデータの`users.json`のBotIdと、メッセージに記載されているBotIdが異なるためです  
[bots.info](https://api.slack.com/methods/bots.info)や[users.info](https://api.slack.com/methods/users.info)のAPIで取得できるBot情報を差分比較しても、updatedが1時間ほど違うだけでそれ以外の情報はほぼ同じとなっており、BotIdが異なっている理由は不明です  
そのため、エクスポートデータだけではBotIdが照合できないので、照合するためにSlackBot経由でSlackWebAPIからBot情報を取得しています  

## 移行のオプション機能

移行のオプション機能として、下記の機能があります  
メッセージファイルをビルドする前に、`.dist/user.json`ファイルにDiscordのユーザーIDやユーザー名を手動で設定することで機能します  

- メッセージ内のメンションなどのユーザ名の変更
- 移行したPrivateチャンネルへのユーザーの自動join

## Privateチャンネルの移行

Privateチャンネルの移行は全てのチャンネルのエクスポートデータから移行した場合のみ可能です  
全てのチャンネルのエクスポートを行うためには、Slackのビジネスプラス以上のプランかつ**ワークスペースのオーナーの権限**で[全てのチャンネルと会話のデータエクスポートを申請する](https://slack.com/intl/ja-jp/help/articles/1500001548241-%E3%81%99%E3%81%B9%E3%81%A6%E3%81%AE%E4%BC%9A%E8%A9%B1%E3%81%AE%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%82%92%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%81%99%E3%82%8B)必要があります  
Slackは[後からPrivate→Publicチャンネルに変更不可](https://slack.com/intl/ja-jp/help/articles/213185467-%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%82%92%E3%83%97%E3%83%A9%E3%82%A4%E3%83%99%E3%83%BC%E3%83%88%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%81%AB%E5%A4%89%E6%8F%9B%E3%81%99%E3%82%8B)となっており、実質的にSlackのプロ以下のプランではPrivateチャンネルのエクスポートはできません  

## Discordにアップロードできる最大ファイルサイズを超えるSlackの添付ファイル

[Slackにアップロードできる最大ファイルサイズは最大1GB](https://slack.com/intl/ja-jp/help/articles/201330736-%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92-Slack-%E3%81%AB%E8%BF%BD%E5%8A%A0%E3%81%99%E3%82%8B)ですが、[Discordにアップロードできる最大ファイルサイズは最大100MB](https://support.discord.com/hc/ja/articles/360028038352-%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%83%96%E3%83%BC%E3%82%B9%E3%83%88-)で、サーバーブーストレベルに応じて変わります  

そのため、Slackのメッセージの添付ファイルのサイズによっては、Discordにアップロードできないファイルが存在する可能性があります  
回避策として、Discordのアップロードできる最大ファイルサイズを超える添付ファイルはファイルURLをメッセージの末尾に記載し、それ以外のファイルはDiscordにアップロードする仕様となっています  

なお、Slackのワークスペースを削除した場合、添付ファイルのファイルURLにアクセスできなくなると思われますので、注意してください  
メッセージファイルをビルド時もしくはメッセージをデプロイ時に、メッセージにDiscordにアップロードできる最大ファイルサイズを超える添付ファイルがある場合、下記の警告を出力します  
より多くの添付ファイルを移行したい場合は、Discordにアップロードできる最大ファイルサイズの上限を解放するために、[サーバーのブースト](https://support.discord.com/hc/ja/articles/360028038352-%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%83%96%E3%83%BC%E3%82%B9%E3%83%88-)を検討してください  

```text
⚠️ Message has attachments that exceed Discord's maximum file size.
Attachments that exceed Discord's maximum file size will be appended to the message as a file URL.
Consider releasing the maximum file upload size limit with Discord's server boost.
```

## アーカイブされたチャンネルの移行

Discordにはチャンネルのアーカイブ機能がないため、アーカイブされたチャンネルはARCHIVEカテゴリーにまとめ、それ以外のチャンネルはCHANNELカテゴリーにまとめる仕様となっています  

アーカイブされたチャンネルを移行したくない場合は、`.envrc`ファイルのMIGRATE_ARCHIVEの環境変数の値に「"false"」を設定し、  
`direnv allow`のコマンドを実行して、環境変数の変更を反映してからコマンドを実行してください  

## メッセージの形式

Discordに表示されるメッセージの形式は下記のようになっています  

```text
------------------------------------------------\n
<絵文字アイコン>  **<ユーザー名(Bot名)>** YYYY/MM/DD HH:mm
<メッセージ内容>
<Discordにアップロードできる最大ファイルサイズを超過したファイルのURL>
```

絵文字アイコンは下記のようにメッセージを送信したSlackユーザーのユーザータイプを示します  

| 絵文字アイコン | ユーザータイプ     |
|:------------:|:----------------|
| 🤖           | Bot             |
| 😃           | アクティブユーザー |
| 🥶           | 解約済みユーザー   |

メッセージの最初の行に切り取り線を表示しない場合は、`.envrc`ファイルのSHOW_CUT_LINEの環境変数の値に「"false"」を設定し、  
`direnv allow`のコマンドを実行して、環境変数の変更を反映してからコマンドを実行してください  
