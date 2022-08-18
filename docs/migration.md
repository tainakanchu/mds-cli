# 移行されるものと移行されないもの

## 移行されるもの

- Public/Privateチャンネル　<span style="color:crimson;">※1</span>
- アーカイブされたチャンネル
- チャンネルのメッセージ
- チャンネルのリプライメッセージ
- メッセージの添付ファイル <span style="color:crimson;">※2</span>

<span style="color:crimson;">※1</span> Privateチャンネルの移行は、全てのチャンネルのエクスポートデータから移行した場合のみ可能です  
通常のエクスポートデータにはPrivateチャンネルは含まれていないため、Slackに申請し、全てのチャンネルのエクスポートデータを取得する必要があります  
<span style="color:crimson;">※2</span> 基本的にメッセージの添付ファイルはそのままDiscordに移行されますが、  
Discordの最大ファイルアップロードサイズを超えたメッセージの添付ファイルはファイルURLとして移行されます  

## 移行されないもの

- Slackのユーザー
- SlackのユーザーのDM(ダイレクトメッセージ)
- SlackBot
- ピン留めアイテム
