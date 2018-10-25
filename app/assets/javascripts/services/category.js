/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('Category', ["$resource", $resource=>
  $resource("/api/categories/:id",
    {id: "@id"}, {
    update: {
      method: 'PUT'
    }
  }
  )

]);
