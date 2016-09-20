import {SetDrawerAction, RequestQuestListAction, ReceiveQuestListAction} from './ActionTypes'
import {QuestType} from '../reducers/StateTypes'

function receiveQuestList(json: {quests: QuestType[], nextToken: string}): ReceiveQuestListAction {
  return {
    type: 'RECEIVE_QUEST_LIST',
    quests: json.quests,
    nextToken: json.nextToken,
    receivedAt: Date.now()
  };
}

function fetchQuestList(user: string, dispatch: Redux.Dispatch<any>): JQueryPromise<any> {
  dispatch({type: 'REQUEST_QUEST_LIST'} as RequestQuestListAction);
  var data: {owner?: string} = {};
  if (user) {
    data.owner = user;
  }
  return $.post("/quests", JSON.stringify(data)).done((data: string) => dispatch(receiveQuestList(JSON.parse(data)))); // TODO: Add fail
}

export function setDrawer(user: string, is_open: boolean): ((dispatch: Redux.Dispatch<any>) => JQueryPromise<any>) {
  return (dispatch: Redux.Dispatch<any>) => {
    dispatch({type: 'SET_DRAWER', is_open} as SetDrawerAction);
    if (is_open) {
      return fetchQuestList(user, dispatch);
    }
  }
}