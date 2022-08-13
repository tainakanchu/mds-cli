# MSD

SlackからDiscordにチャンネルのメッセージを移行するためのnode.jsのCLI  
SlackのエクスポートデータをDiscordに移行できるデータに変換し、Discord Botがチャンネルの作成とメッセージの出力を行う  
MSDは(Migrate from Slack to Discord)の略称  

> **Warning**  
> このCLIは簡易的に作ったもののため、十分にテストされていません  
> 将来的にSlackやDiscordのAPIの仕様変更によって、使用できなくなる可能性があります  
> 動作の保証ができないので、利用する際には自己責任でお願いします  

## 仕様

### Slackのデータの取得

下記の理由でメッセージの取得をSlack APIからではなく、エクスポートデータから参照する仕様となっています

- メッセージの総数によってはAPIを叩く回数が膨大になり、データの完全性を保証しにくい
- APIのクォータやレスポンスを考慮してページネーションで再起的にAPIを叩く必要があり、その処理やそれに伴うデータ取得失敗時のリトライ処理などの不安定になりそうな実装をできるだけ排除したい
- メッセージにユーザー名の情報が含まれない <span style="color:crimson;">※1</span>

<span style="color:crimson;">※1</span> Slack APIの[conversations.history](https://api.slack.com/methods/conversations.history)で取得したメッセージは、ユーザー情報がユーザーIDのみで、ユーザー名が含まれず、取得するためのオプションが無いため、別途ユーザー名を取得する必要があります

### Discordへの移行設定のオプション

Discordへの移行する際のオプションとして、下記のオプションがあります

- メッセージ内のメンションなどに含まれるユーザ名の変更
- 移行したPrivateチャンネルへのユーザーの自動join

メッセージのデータを変換する前に、変換したユーザーのデータファイル`.migtation/user.json`に、DiscordのユーザーIDやユーザー名を手動で設定することで実行可能です

### アーカイブチャンネルの移行

Discordにはチャンネルのアーカイブ機能がないため、アーカイブされたチャンネルはARCHIVEカテゴリーにまとめる仕様となっています  
それ以外のチャンネルはCHANNELカテゴリーにまとめる仕様となっています  

### メッセージの形式

メッセージの最初の行には絵文字アイコン、ユーザー名、投稿日の情報が含まれます  
絵文字アイコンは「🤖」はBot、「🥶」は解約済みユーザー、「😃」はアクティブユーザーからのメッセージであることを示します  

## できる事とできない事

### できる事

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

### できない事

- SlackBotの移行
- SlackのDM(ダイレクトメッセージ)の移行
- Discordのユーザーの自動作成

## 前提

1. [direnvのインストール](https://github.com/direnv/direnv)
2. [Voltaのインストール](https://docs.volta.sh/guide/getting-started)
3. [Discord Botの作成](#create-discord-bot)
4. [Slackのデータのエクスポート](#export-slack-data)
5. [環境変数の設定](#setting-environment-variables)
6. [実行環境の設定](#setting-execution-environment)

<h3 id="create-discord-bot">Discord Botの作成</h3>

1. [DiscordのDeveloper Portalのページ](https://discord.com/developers/applications)で、「[Botアカウント作成](https://discordpy.readthedocs.io/ja/latest/discord.html#creating-a-bot-account)」」などの記事を参考に任意の名前のBotを作成
2. Public Botのチェックを外し、Botを公開にしておく
3. OAuth2 > URL GeneratorでSCOPESの項目には「Bot」を、Bot Permissionsの項目には「Send Messages」と「Manage Channels」にチェックを入れる
4. GENERATED URLの項目で生成されたURLを開いて、移行先のサーバーにBotを追加する
5. Bot > Build A Botの項目からトークンを控えておく
6. Discordのアプリで、DiscordのサーバーIDを表示させるために、Discordのアプリの設定 > 詳細設定で開発者モードを有効化にする
7. Discordのアプリで、サーバーを右クリックで表示される「IDをコピー」の項目をクリックしてDiscordのサーバーIDを控えておく

<h3 id="export-slack-data">Slackのデータのエクスポート</h3>

1. [Slackのデータのエクスポートのページ](https://slack.com/services/export)で、「[ワークスペースのデータをエクスポートする](https://slack.com/intl/ja-jp/help/articles/201658943-%E3%83%AF%E3%83%BC%E3%82%AF%E3%82%B9%E3%83%9A%E3%83%BC%E3%82%B9%E3%81%AE%E3%83%87%E3%83%BC%E3%82%BF%E3%82%92%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%81%99%E3%82%8B)」などの記事を参考に、**ワークスペースのオーナー権限**でSlackのデータをエクスポートし、zipファイルをダウンロードする
2. zipファイルを解凍し、解凍したフォルダを「.slack」にリネームしてこのリポジトリのトップに配置する

<h3 id="setting-environment-variables">環境変数の設定</h3>

下記のコマンドで、環境変数の設定ファイルを作成する

```zsh
cp .envrc.sample .envrc
```

.envrcの環境変数に、トークンやサーバーIDなどの情報を設定する

```zsh
export NODE_OPTIONS=--openssl-legacy-provider
export IS_MIGRATE_ARCHIVE="true" # ← アーカイブされたチャンネルを移行しない場合はfalseを設定
export DISCORD_BOT_TOKEN="" # ← Discord Botのトークンを設定
export DISCORD_SERVER_ID=""　# ← DiscordのサーバーIDを設定
```

下記のコマンドで、変更した環境変数の値を反映する

```zsh
direnv allow
```

<h3 id="setting-execution-environment">実行環境の設定</h3>

下記のコマンドで、VoltaでNode.jsとnpmを設定する

```zsh
volta install node@18.7.0 npm@8.15.1

npm install
```

必要に応じて下記のコマンドで、パッケージをアップデートする

```zsh
npx ncu -u

npm install
```

## 使用方法

最初に下記のコマンドを順次実行し、Slackのユーザーのデータファイルを、Discordに移行できるデータファイルに変換する  

```zsh
# 作業ディレクトリ初期化などの初期化処理をする
npm run init

# Slackのユーザーのデータファイルを、Discordに移行できるデータファイルに変換する
npm run convert:user
```

次にメッセージ内のメンションなどに含まれるユーザ名の変更、移行したPrivateチャンネルへのユーザーの自動joinをしたい場合は、  
任意で移行するユーザーのデータファイル`.migtation/user.json`に対象の各ユーザーのユーザー名、ユーザーIDを設定する  

```json
{
  "slack": {
    "user_id": "U00XXXXXXXX",
    "user_name": "Slackのユーザー名",
    "deleted": false,
    "is_bot": false
  },
  "discord": {
    "user_id": "", // ← DiscordのユーザーIDを設定
    "user_name": "" // ← Discordのユーザー名を設定
  }
}
```

最後に下記のコマンドを順次実行し、Slackの残りの各データファイルをDiscordに移行できるデータファイルに変換後、  
Discordにデプロイする  

```zsh
# Slackのチャンネルのデータファイルを、Discordに移行できるデータファイルに変換する
npm run convert:channel

# Slackのメッセージのデータファイルを、Discordに移行できるデータファイルに変換する
npm run convert:message

# Discordにチャンネルを作成する
npm run deploy:channel

# Discordの作成したチャンネルにメッセージを作成する
npm run deploy:message
```

Discordへメッセージのデータの移行に失敗した場合は、下記のコマンドを実行することでリセットできる  

```zsh
# 作成したチャンネルを削除する
npm run delete:channel
```

## 既知の問題

### @types/nodeにfsPromise.constantsが無い

下記のissueで修正反映待ち中  
修正反映まではfs.constantsで代用  

https://github.com/DefinitelyTyped/DefinitelyTyped/pull/61690

### 並列化・非同期化

for文で直列でやってる処理が多いので、Promise.allSettledなどで並列化できる箇所は並列化したい  
一部同期関数で処理していて、ブロッキング操作になっている箇所があるので、非同期関数に置き換えたい  

## 参考リンク

- [discord.js](https://discord.js.org/)
- [discord GuildChannelManager](https://discord.js.org/#/docs/main/stable/class/GuildChannelManager)
- [Slack Web API](https://api.slack.com/web#spec)
- [Slackのメッセージの取得](https://api.slack.com/messaging/retrieving)
- [Slackからエクスポートしたデータの読み方](https://slack.com/intl/ja-jp/help/articles/220556107-Slack-%E3%81%8B%E3%82%89%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%81%97%E3%81%9F%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AE%E8%AA%AD%E3%81%BF%E6%96%B9)
- [Slack Message Event](https://api.slack.com/events/message)
- [チャンネルをプライベートチャンネルに変換する](https://slack.com/intl/ja-jp/help/articles/213185467-%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%82%92%E3%83%97%E3%83%A9%E3%82%A4%E3%83%99%E3%83%BC%E3%83%88%E3%83%81%E3%83%A3%E3%83%B3%E3%83%8D%E3%83%AB%E3%81%AB%E5%A4%89%E6%8F%9B%E3%81%99%E3%82%8B)
- [Slackのインポート/エクスポートの手段](https://slack.com/intl/ja-jp/help/articles/204897248-Slack-%E3%81%AE%E3%82%A4%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%88-%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E3%81%AE%E6%89%8B%E6%AE%B5)
- [無料版Slackのメッセージが90日で消えちゃうらしいのでDiscordにメッセージを移行させるツール作った](https://qiita.com/yuki-n/items/25e73490d82a0ad3c3fd)
- [ブロッキングとノンブロッキングの概要](https://nodejs.org/ja/docs/guides/blocking-vs-non-blocking/)
- [ファイルをSlackに追加する](https://slack.com/intl/ja-jp/help/articles/201330736-%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92-Slack-%E3%81%AB%E8%BF%BD%E5%8A%A0%E3%81%99%E3%82%8B)
- [What is Discord's file upload limit?](https://discord.me/answers/what-is-discords-file-upload-limit)

## License

[MIT](https://opensource.org/licenses/MIT)
