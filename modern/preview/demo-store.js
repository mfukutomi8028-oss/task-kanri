/* Isolated mock data. No Firebase, fetch, shared-room storage, or product boot code. */
(() => {
 'use strict';
 const today='2026-10-27';
 const users=['福冨','佐藤','鈴木'];
 const labels={open:'未着手',working:'対応中',waiting:'確認待ち',done:'完了'};
 const rows=[
 ['t1','WB-042','受付PC入替の最終確認','working',0,'端末管理','high','2026-10-24'],
 ['t2','WB-046','請求書プリンタの設定確認','waiting',1,'印刷','high','2026-10-26'],
 ['t3','WB-051','医学辞書の登録手順を整理','working',0,'手順書','normal','2026-10-27'],
 ['t4','WB-053','外来端末の更新作業','open',2,'端末管理','normal','2026-10-28'],
 ['t5','WB-054','月次点検チェックリストを更新','open',0,'運用','normal','2026-10-29'],
 ['t6','WB-055','ネットワーク保守の日程調整','open',1,'ネットワーク','normal','2026-10-30'],
 ['t7','WB-056','院内向け案内文の確認','waiting',2,'運用','normal','2026-10-27'],
 ['t8','WB-039','会議室PCの引き渡し','done',0,'端末管理','normal','2026-10-23']
 ];
 const tasks=rows.map(r=>({id:r[0],code:r[1],title:r[2],status:r[3],owner:users[r[4]],category:r[5],priority:r[6],due:r[7],description:'担当者と作業内容を確認し、対応結果を記録します。\nこの内容は画面確認用の架空データです。',checklist:[{text:'対象と作業範囲を確認',done:true},{text:'動作確認と記録',done:false},{text:'担当者へ結果を共有',done:false}],comments:[{by:users[1],at:'10/26 16:40',text:'確認項目を整理しました。手順に沿って最終確認をお願いします。'}],history:[{at:'10/26 16:40',text:'確認内容を更新'},{at:'10/23 09:10',text:'タスクを作成'}]}));
 tasks[0].description='受付の入替用PCについて、印刷と共有フォルダーの動作を確認します。\n作業後は担当者へ確認結果を共有します。';
 const todos=[
 {id:'d1',text:'予備PCの在庫を確認',memo:'保管場所と貸出中の台数を確認する。',done:false},
 {id:'d2',text:'プリンタ設定の回答を確認',memo:'',done:false},
 {id:'d3',text:'会議資料を共有する',memo:'午後の打合せ用。追記した手順も含める。',done:false},
 {id:'d4',text:'今日の作業ログを記録',memo:'',done:false},
 {id:'d5',text:'朝のバックアップ結果を確認',memo:'日次確認済み。',done:true,completedAt:'10/27 08:45'}
 ];
 const schedules=[
 {id:'s1',title:'端末入替の最終確認',date:today,start:'10:00',end:'10:30',place:'受付',owner:users[0]},
 {id:'s2',title:'週次の進捗打合せ',date:today,start:'13:30',end:'14:00',place:'会議室',owner:users[1]},
 {id:'s3',title:'運用手順のレビュー',date:today,start:'16:00',end:'16:30',place:'システム課',owner:users[0]}
 ];
 const memos=[
 {id:'m1',title:'端末入替の確認ポイント',category:'手順',pinned:true,updated:'10/26',body:'入替前に確認すること\n\n'+Array.from({length:12},(_,i)=>`${i+1}. 対象端末と接続機器、使用者を確認。結果を作業記録へ残す。`).join('\n\n')},
 {id:'m2',title:'今週の引継ぎメモ',category:'引継ぎ',pinned:false,updated:'10/27',body:'午後の打合せで共有する項目\n\n・端末入替の進捗\n・保守日程の候補\n・手順書の更新範囲\n\n完了した作業と確認待ちを分けて記録する。'},
 {id:'m3',title:'プリンタ確認の手順',category:'手順',pinned:false,updated:'10/25',body:'1. 対象プリンタ名を確認\n2. Windowsのテスト印刷\n3. 業務アプリの出力先を確認\n4. 実際の帳票で確認\n\nすべて画面確認用のサンプルです。'}
 ];
 window.Demo={today,users,labels,tasks,todos,schedules,memos,next:100,revision:0,changed(){this.revision++},id(prefix){return prefix+(++this.next)},days(date){return Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000)}};
})();
