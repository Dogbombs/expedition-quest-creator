// Copyright 2015-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

var gcloud = require('gcloud');
var config = require('../config');
//var background = require('../lib/background');

var ds = gcloud.datastore({
  projectId: config.get('GCLOUD_PROJECT')
});
var user_kind = 'User';
var quest_kind = 'Quest';

// TODO: Decommision this.
// Translates from Datastore's entity format to
// the format expected by the application.
//
// Datastore format:
//   {
//     key: [kind, id],
//     data: {
//       property: value
//     }
//   }
//
// Application format:
//   {
//     id: id,
//     property: value
//   }
function fromDatastore (obj) {
  obj.data.id = obj.key.id;
  return obj.data;
}

// TODO: Decommision this.
// Translates from the application's format to the datastore's
// extended entity property format. It also handles marking any
// specified properties as non-indexed. Does not translate the key.
//
// Application format:
//   {
//     id: id,
//     property: value,
//     unindexedProperty: value
//   }
//
// Datastore extended format:
//   [
//     {
//       name: property,
//       value: value
//     },
//     {
//       name: unindexedProperty,
//       value: value,
//       excludeFromIndexes: true
//     }
//   ]
function toDatastore (obj, nonIndexed) {
  nonIndexed = nonIndexed || [];
  var results = [];
  Object.keys(obj).forEach(function (k) {
    if (obj[k] === undefined) {
      return;
    }
    results.push({
      name: k,
      value: obj[k],
      excludeFromIndexes: nonIndexed.indexOf(k) !== -1
    });
  });
  return results;
}

function getOwnedQuests (userId, limit, token, cb) {
  var q = ds.createQuery([quest_kind])
    .hasAncestor(ds.key([user_kind, parseInt(userId, 10)]))
    .filter('tombstone', null)
    .limit(limit)
    .start(token);

  ds.runQuery(q, function (err, entities, nextQuery) {
    if (err) {
      return cb(err);
    }
    var hasMore = entities.length === limit ? nextQuery.startVal : false;
    cb(null, entities.map(fromDatastore), hasMore);
  });
}

// Creates a new quest or updates an existing quest with new data. The provided
// data is automatically translated into Datastore format.
// The quest will be queued for background processing.
// TODO: This should automatically keep versions, and not store data directly.
function update (user, id, data, process, cb) {
  var key;
  if (id !== undefined && id !== "null") {
    console.log("Updating quest " + id + " owned by " + user);
    key = ds.key([user_kind, parseInt(user, 10), quest_kind, parseInt(id, 10)]);
  } else {
    key = ds.key([user_kind, parseInt(user, 10), quest_kind]);
    console.log("Saving new quest owned by " + user);
  }

  // Tombstone must be explicitly set for indexing purposes.
  data.tombstone = null;

  var entity = {
    key: key,
    data: toDatastore(data, ['description'])
  };

  ds.save(
    entity,
    function (err) {
      if (err) {
        return cb(err);
      }
      data.id = entity.key.id;
      if (process) {
        //background.queueBook(data.id);
      }
      cb(null, data);
    }
  );
}

function tombstone (user, id, cb) {
  var transaction = ds.transaction();

  // Done inside a transaction to prevent concurrency bugs on read-modify-write.
  transaction.run(function (err) {
    if (err) {
      return cb(err);
    }

    var quest_key = ds.key([user_kind, parseInt(user, 10), quest_kind, parseInt(id, 10)]);

    transaction.get(quest_key, function (err, quest) {
      if (err) {
        return transaction.rollback(function (_err) {
          return cb(_err || err);
        });
      }

      if (!quest) {
        // Nothing to do
        return cb();
      }

      quest.data.tombstone = Date.now();
      transaction.save(quest);
      transaction.commit(function (err) {
        if (err) {
          return cb(err);
        }
        cb(); // The transaction completed successfully.
      });
    });
  });
}

function read (user, id, cb) {
  var key = ds.key([user_kind, parseInt(user, 10), quest_kind, parseInt(id, 10)]);
  ds.get(key, function (err, entity) {
    if (err) {
      return cb(err);
    }
    if (!entity) {
      return cb({
        code: 404,
        message: 'Not found'
      });
    }
    cb(null, fromDatastore(entity));
  });
}

function _delete (user, id, cb) {
  var key = ds.key([user_kind, parseInt(user, 10), quest_kind, parseInt(id, 10)]);
  ds.delete(key, cb);
}

module.exports = {
  create: function (data, queueBook, cb) {
    update(null, data, queueBook, cb);
  },
  read: read,
  update: update,
  tombstone: tombstone,
  unsafedelete: _delete,
  list: list,
  getOwnedQuests: getOwnedQuests
};
