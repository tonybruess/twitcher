/**
 * Copyright 2012-present Thom Seddon.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

if (!chrome.cookies) {
  chrome.cookies = chrome.experimental.cookies;
}

// Globals
var COOKIE_TOKEN = 'auth_token';
var COOKIE_ID = 'twid';

/**
 * Convenience methods for accessing accounts
 */

var accounts = {
  accounts: {},
  get: function (uid) {
    return this.accounts[uid];
  },
  set: function (uid, data, callback) {
    this.accounts[uid] = data;
    if (callback) this.save(callback);
  },
  remove: function (uid, callback) {
    delete this.accounts[uid];
    if (callback) this.save(callback);
  },
  save: function (callback) {
    var accounts = this.accounts;
    var json = JSON.stringify(accounts);
    chrome.storage.sync.set({ 'accounts': json }, function () {
      callback(accounts);
    });
  },
  getAll: function (callback) {
    if (!callback) return this.accounts;
    var self = this;
    chrome.storage.sync.get('accounts', function (json) {
      if (json.accounts && json.accounts.length) {
        self.accounts = JSON.parse(json.accounts);
      }
      callback(self.accounts);
    });
  },
  setAll: function (accounts, callback) {
    this.accounts = accounts;
    if (callback) this.save(callback);
  }
};

/**
 * Listen for messages
 */

chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {

  if (sender.id !== window.location.host)
    // Not from us
    return;

  switch (request.type) {
    case 'getAccounts':
      accounts.getAll(sendResponse);
      break;
    case 'removeAccount':
      accounts.remove(request.uid, function (accounts) {
        sendResponse(accounts);
      });
      break;
    case 'switchAccount':
      var account = accounts.get(request.uid);
      if (account && !account.ignored) {
        var expires = new Date;
        expires.setFullYear(expires.getFullYear() + 10);

        // Set token cookie
        chrome.cookies.set({
          url: 'https://twitter.com',
          name: COOKIE_TOKEN,
          value: account.token,
          domain: '.twitter.com',
          path: '/',
          secure: true,
          httpOnly: true,
          expirationDate: expires / 1000
        });

        // Remove user id cookie
        chrome.cookies.remove({
          url: 'https://twitter.com',
          name: COOKIE_ID
        });
      }

      // Reload
      chrome.tabs.getSelected(null, function (tab) {
        chrome.tabs.reload(tab.id);
      });
      break;
    case 'currentAccount':
      // Make sure we have go all accounts before saving
      accounts.getAll(function () {
        // Get the token
        chrome.cookies.get({
          url: 'https://twitter.com',
          name: COOKIE_TOKEN
        }, function (cookie) {
          if (!cookie) return callback();

          // Save cookie
          var account = request.currentAccount;
          accounts.set(account.uid, {
            name: account.name,
            img: account.img,
            token: cookie.value
          }, sendResponse);
        });
      });
      break;
    case 'ignore':
      accounts.getAll(function (all) {
        // Reset
        for (var uid in all) {
          all[uid].ignored = false;
        }

        // Update
        request.ignore.forEach(function (uid) {
          all[uid].ignored = true;
        });

        // Save
        accounts.setAll(all, sendResponse);
      });
      break;
    default:
      return false;
  }

  // Indicate response via callback
  return true;
});

/**
 * Google analytics
 */

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-17516578-20']);
_gaq.push(['_trackPageview']);
(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
