import {
  NEW_QUEST, LOAD_QUEST, SAVE_QUEST,
  ReceiveQuestLoadAction,
  RequestQuestSaveAction, ReceiveQuestSaveAction,
  RequestQuestPublishAction, ReceiveQuestPublishAction,
  RequestQuestUnpublishAction, ReceiveQuestUnpublishAction,
} from './ActionTypes'
import {QuestType, ShareType} from '../reducers/StateTypes'

import {setDialog} from './dialogs'
import {pushError, pushHTTPError} from '../error'
import {realtimeUtils} from '../auth'
import {loadQuestXML} from 'expedition-app/app/actions/web'

// Loaded on index.html
declare var window: any;
declare var VERSION: string;

var toXML: any = (require('../../translation/to_xml') as any).toXML;
var toMeta: any = require('../../translation/to_meta');

function receiveQuestLoad(quest: QuestType ): ReceiveQuestLoadAction {
  return {type: 'RECEIVE_QUEST_LOAD', quest};
}

const QUEST_DOCUMENT_HEADER = `This quest was automatically generated by the Expedition Quest Creator at http://quests.expeditionrpg.com.
To make changes: right-click the file in Drive, select "Open With" and choose "Expedition Quest Creator".\n\nEngine v` + VERSION + '\n\n';

const NEW_QUEST_TEMPLATE = `# Quest Title
summary: Quest summary
author: Your Name
email: email@example.com
url: yoursite.com
minPlayers: 2
maxPlayers: 4
minTimeMinutes: 20
maxTimeMinutes: 40

_Roleplay Title_

roleplay text

**end**`;

function updateDriveFile(fileId: string, fileMetadata: any, text: string, callback: () => any) {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  text = QUEST_DOCUMENT_HEADER + text;
  var base64Data = btoa(text);
  var multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: text/plain\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      base64Data +
      close_delim;

  var request = window.gapi.client.request({
      'path': '/upload/drive/v2/files/' + fileId,
      'method': 'PUT',
      'params': {'uploadType': 'multipart', 'alt': 'json'},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody});
  request.execute(callback);
}

export function loadQuestFromURL(userid: string, dispatch: Redux.Dispatch<any>) {
  loadQuest(userid, dispatch, (window.location.hash) ? window.location.hash.substr(1) : null);
}


export function newQuest(userid: string, dispatch: any) {
  var insertHash = {
    'resource': {
      mimeType: "text/plain",
      title: "New Expedition Quest",
      description: "Created with the Expedition Quest Creator",
    }
  };
  window.gapi.client.drive.files.insert(insertHash).execute(function(createResponse: {id: string}) {
    updateDriveFile(createResponse.id, {}, "", function() {
      loadQuest(userid, dispatch, createResponse.id);
    });
  });
}

function getPublishedQuestMeta(published_id: string, cb: (meta: QuestType)=>any) {
  $.post('/quests', JSON.stringify({id: published_id}), function(result: any) {
    result = JSON.parse(result);
    if (result.error) {
      throw new Error(result.error);
    }

    cb(result.quests[0] as QuestType);
  });
}

export function loadQuest(userid: string, dispatch: any, docid?: string) {
  if (docid === null) {
    console.log("Creating new quest");
    return newQuest(userid, dispatch);
  }
  realtimeUtils.load(docid, function(doc: any) {
    window.location.hash=docid;
    var md = doc.getModel().getRoot().get('markdown');
    var text: string = md.getText();
    getPublishedQuestMeta(userid + '_' + docid, function(quest: QuestType) {
      quest = Object.assign(quest || {}, toMeta.fromMarkdown(text));
      quest.id = docid;
      quest.mdRealtime = md;
      dispatch(receiveQuestLoad(quest));
    });
  },
  function(model: any) {
    var string = model.createString();
    string.setText(NEW_QUEST_TEMPLATE);
    model.getRoot().set('markdown', string);
  });
}

export function publishQuest(quest: QuestType): ((dispatch: Redux.Dispatch<any>)=>any) {
  return (dispatch: Redux.Dispatch<any>): any => {
    var text = quest.mdRealtime.getText();
    try {
      text = toXML(text, false);
      dispatch({type: 'QUEST_VALID', quest});
    } catch (e) {
      dispatch({type: 'QUEST_INVALID', quest})
      pushError(e);
      dispatch(setDialog('ERROR', true));
      return;
    }

    dispatch({type: 'REQUEST_QUEST_PUBLISH', quest} as RequestQuestPublishAction);
    return $.post("/publish/" + quest.id, text, function(result_quest_id: string) {
      quest.published = (new Date(Date.now()).toISOString());
      dispatch({type: 'RECEIVE_QUEST_PUBLISH', quest} as ReceiveQuestPublishAction);
    }).fail(pushHTTPError);
  }
}

export function saveQuest(quest: QuestType): ((dispatch: Redux.Dispatch<any>)=>any) {
  return (dispatch: Redux.Dispatch<any>): any => {
    dispatch({type: 'REQUEST_QUEST_SAVE', quest} as RequestQuestSaveAction);

    var text: string = quest.mdRealtime.getText();
    try {
      const validationCheck = toXML(text, false);
      dispatch({type: 'QUEST_VALID', quest});
      dispatch(loadQuestXML(validationCheck));
    } catch (e) {
      dispatch({type: 'QUEST_INVALID', quest});
    }

    var meta = toMeta.fromMarkdown(text) as QuestType;
    // For all metadata values, see https://developers.google.com/drive/v2/reference/files
    var fileMeta = {
      title: meta.title,
      description: meta.summary,
    };

    updateDriveFile(quest.id, fileMeta, text, function() {
      dispatch({type: 'RECEIVE_QUEST_SAVE', quest: meta} as ReceiveQuestSaveAction);
    });
  };
}

export function unpublishQuest(quest: QuestType): ((dispatch: Redux.Dispatch<any>)=>any) {
  return (dispatch: Redux.Dispatch<any>): any => {
    dispatch({type: 'REQUEST_QUEST_UNPUBLISH', quest} as RequestQuestUnpublishAction);
    return $.post("/unpublish/" + quest.id, function(result_quest_id: string) {
      quest.published = undefined;
      dispatch({type: 'RECEIVE_QUEST_UNPUBLISH', quest} as ReceiveQuestUnpublishAction);
    }).fail(pushHTTPError);
  };
}