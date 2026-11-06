// Ver.582 synthetic, invented records only. No real patient, staff or task data.
// Every UID has todos/inbox/reminders so that RTDB can persist all draft maps.
// Fields deliberately include recurrence, history, attachments metadata, colors,
// scheduled task relations, archive/tombstone and unknown extension properties.
export const syntheticRoomV582 = () => ({
  tasks:{
    taskA:{id:'taskA',title:'架空の月次点検',description:'テストのみ',
      revision:0,status:'進行中',assignee:'職員A',dueDate:'2026-11-25',
      checklist:[{title:'架空の確認',done:false}],
      comments:[{author:'職員B',content:'ダミーコメント'}],
      history:[{operation:'created',at:1750000000}],
      tags:['確認','テスト'],recurrenceRule:{type:'monthly',day:25,interval:1},
      nextRecurringTaskId:'taskB',knowledgeId:'knowledgeA',
      attachments:[{id:'fakeImage',mime:'image/png',name:'sample.png'}],
      futureField:{nested:{preserve:'そのまま'}}},
    taskB:{id:'taskB',title:'翌月の架空点検',revision:1,
      recurringParentId:'taskA',completed:false}
  },
  todos:{
    todoA:{id:'todoA',owner:'職員A',text:'架空のToDo A',memo:'未完了メモ',
      revision:0,completed:false,order:2,createdAt:1710000000},
    todoB:{id:'todoB',owner:'職員B',text:'架空のToDo B',memo:'ダミーメモ',
      revision:1,completed:true,order:0,createdAt:1710000010}
  },
  schedules:{
    scheduleA:{id:'scheduleA',revision:0,relatedTaskId:'taskA',
      date:'2026-11-25',time:'14:00',memo:'架空の予定',
      recurrence:{type:'monthly',interval:1,until:'2027-01-25'},
      unknownScheduleExtension:{flag:true}}
  },
  knowledge:{
    knowledgeA:{id:'knowledgeA',taskId:'taskA',body:'架空の情報'}
  },
  businessMemos:{
    memoA:{id:'memoA',createdBy:'職員A',body:'架空の業務メモ',
      paperColor:'#f7c9d7',pinned:true,sortOrder:5,updatedAt:1760000000,
      arbitraryExtra:{category:'分類A'}},
    memoB:{id:'memoB',createdBy:'職員B',body:'別の架空メモ',
      paperColor:'#cce7ff',sortOrder:3,updatedAt:1760000010}
  },
  taskStarts:{taskA:{startAt:1760000000},taskB:{startAt:1760000500}},
  workflowV148:{
    reminders:{
      '職員A':{taskA:{notifyAt:1761000000}},
      '職員B':{taskB:{notifyAt:1761000300}}
    },
    otherSettings:{custom:'残す設定'}
  },
  workflowV152:{
    inbox:{
      '職員A':{eventA:{taskId:'taskA',body:'架空の通知'}},
      '職員B':{eventB:{taskId:'taskB',body:'ダミー通知'}}
    },
    archives:{historical:{archivedAt:1760000000}},
    duplicates:{recordA:{targetId:'taskB'}},
    futureExtension:{retain:'unknown-field'}
  },
  meta:{
    migrationFixture:'v582-synthetic',
    users:['職員A','職員B'],
    settings:{colors:['青','紫'],options:{compact:true}}
  }
});
export const syntheticUidMapV582 = () => ({'職員A':'uidA','職員B':'uidB'});
export const syntheticEmulatorOptionsV582 = () => ({
  projectId:'demo-task-kanri-v568',
  targetRoomId:'demo-v582-target'
});
