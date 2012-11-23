(function (win, doc) {
	"use strict";

	var Ti = win.Ti;

	//Open the database first
	var db_file = Ti.Filesystem.getFile(Ti.Filesystem.getApplicationDataDirectory(), 'news.db');
	var db;
	if (!db_file.exists()) {
		db = Ti.Database.openFile(db_file);
		//db.execute('begin transaction');

		try {
			db.execute('create table if not exists "news" ( \
			"id" INTEGER PRIMARY KEY AUTOINCREMENT, \
			"guid" TEXT, \
			"title" TEXT, \
			"link" TEXT, \
			"categories" TEXT, \
			"thumb" TEXT, \
			"updated" INTEGER, \
			"fetched" INTEGER, \
			"read" INTEGER DEFAULT (0), \
			"summary" BLOB, \
			"content" BLOB \
		);');

			db.execute('CREATE UNIQUE INDEX "guid" on news (guid ASC)');
			//db.execute('commit');

		}
		catch (e) {
			//db.execute('rollback');
			alert(e);
		}
	}
	else {
		db = Ti.Database.openFile(db_file);
	}

	/**
	 * get last updated
	 * @param {String} guid
	 * @return {Number}
	 */
	function get_last_update(guid) {
		var rows = db.execute('select updated from "news" where guid = "' + guid + '" limit 1');
		return (rows && rows.isValidRow() && rows.rowCount() > 0) ? rows.fieldByName('updated') : 0;
	}


	function query_result(table, fields, condition, limit, callback) {
		var q = 'SELECT ';
		if (typeof fields === 'string') {
			q += fields;
		}
		else if (Array.isArray(fields)) {
			q += fields.join(', ');
		}
		else {
			q += '*';
		}
		q += ' from "' + table + '"';

		if (condition) {
			q += ' where ' + condition;
		}

		if (limit) {
			q += ' limit ' + limit;
		}

		var rows = db.execute(q);
		var result = [];
		while (rows.isValidRow()) {
			//Alert the value of fields id and firstName from the Users database
			var arr = {};
			for (var i = 0; i < rows.fieldCount(); i++) {
				arr[rows.fieldName(i)] = rows.field(i);
			}
			if (callback) {
				callback(arr);
			}
			else {
				result.push(arr);
			}
			rows.next();
		}

		if (callback) {
			return rows.rowCount();
		}
		else {
			return result;
		}
	}

	win.tes = function () {
		var html = '';
		query_result('news', 'title, thumb, summary, link', null, null, function (arr) {
			html += '<article class="childnews hitem"><div class="news-image"><img src="' + arr.thumb + '" /></div></article>';
		});
		alert(html);
	};


	/**
	 *
	 * @param {String} url
	 * @param {Function} callback
	 */
	function fetch_news(url, callback) {
		var client = Ti.Network.createHTTPClient();

		client.onload = function (e) {
			//var xml = this.responseXML;
			//var items = xml.evaluate('/rss/channel/item');
			var parser = new DOMParser();
			var xml = parser.parseFromString(e.responseText, 'text/xml');
			//alert(xml.documentElement.getElementsByTagName('item'));
			var items = xml.documentElement.getElementsByTagName('entry');

			//alert(items);
			var result = [];
			for (var i = 0; i < items.length; i++) {
				//var title = items[i].getElementsByTagName('title')[0].textContent;
				var title = items[i].getElementsByTagName('title')[0].textContent;
				var updated = items[i].getElementsByTagName('updated')[0].textContent;
				var id = items[i].getElementsByTagName('id')[0].textContent;
				var summary = items[i].getElementsByTagName('summary')[0].textContent;
				var categoryNodes = items[i].getElementsByTagName('category');
				var categories = [];
				for (var n = 0; n < categoryNodes.length; n++) {
					categories.push(categoryNodes[0].getAttribute('term'));
				}

				var contentNode = items[i].getElementsByTagName('content')[0];
				var contentHTML = contentNode.textContent;
				var link = contentNode.getAttribute('xml:base');

				var m = /<img[^>]+src="([^"]+)"/i.exec(contentHTML);

				result.push({
					'title':title,
					'updated':updated,
					'guid':id,
					'categories':categories,
					'summary':'',
					'content':contentHTML,
					'link':link,
					'img':(m ? m[1] : null)
				});
				//alert(title);
				//alert(title);
			}

			callback(true, result);
		};

		//Specify request type and open
		client.open('GET', url);

		//Send request
		client.send();
	}


	String.prototype.format = function () {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function (match, number) {
			return typeof args[number] != 'undefined' ? args[number] : match;
		});
	};

	String.prototype.addSlashes = function () {
		return this.replace(/([\\'])/g, "\\$1").
				replace(/\u0008/g, '\\b').
				replace(/\t/g, '\\t').
				replace(/\n/g, '\\n').
				replace(/\f/g, '\\f').
				replace(/\r/g, '\\r');
	};

	//alert('abi\naa'.addSlashes());

	function parseDate(str) {
		var elms = str.substr(0, 19).split(/[\-T:]/);
		return new Date(elms[0], elms[1], elms[2], elms[3], elms[4], elms[5], 0).getTime();
	}

	/**
	 *
	 */
	win.sync = function sync() {
		fetch_news('http://www.sambadhacare.test/feed/atom', function (status, result) {
			if (status) {
				db.execute('begin transaction');
				// 2012-08-29T14:00:59Z
				var success = true;
				for (var i = 0; i < result.length; i++) {
					var item = result[i];
					var updated = Math.floor(parseDate(item.updated) / 1000);
					//alert(item.updated + ' - ' + updated);
					var now = Math.floor(new Date().getTime() / 1000);
					var tmp;
					if ((tmp = get_last_update(item.guid)) < updated) {
						alert(tmp);
						var q = 'REPLACE INTO `news` (guid, title, link, thumb, categories, updated, fetched, read, summary, content) VALUES ' +
								"('{0}', '{1}',  '{2}', '{3}', '{4}',  '{5}', '{6}', '{7}',  '{8}',  '{9}');".format(
										item.guid, item.title.addSlashes(), item.link, item.img, item.categories.join(', ').addSlashes(), updated, now, 0, item.summary.addSlashes(), item.content.addSlashes()
								);
						//alert(q);
						try {
							db.execute(q);
						}
						catch (e) {
							db.execute('rollback');
							alert('sync error ' + e);
							return;
						}

					}

				}
				db.execute('commit');
			}

		});
	}

})(window, document);