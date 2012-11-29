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

			db.execute('create table if not exists "categories" ( \
			"id" INTEGER PRIMARY KEY AUTOINCREMENT, \
			"name" TEXT \
		);');

		}
		catch (e) {
			//db.execute('rollback');
			alert(e);
		}
	}
	else {
		db = Ti.Database.openFile(db_file);
	}

	var categories = [];
	query_result('categories', 'name', null, null, 'name asc', function(res){
		categories.push(res.name);
	});

	win.addEventListener('load', function(){
		show_home();
		update_categories();
	}, false);

	/**
	 * get last updated
	 * @param {String} guid
	 * @return {Number}
	 */
	function get_last_update(guid) {
		var rows = db.execute('select updated from "news" where guid = "' + guid + '" limit 1');
		return (rows && rows.isValidRow() && rows.rowCount() > 0) ? rows.fieldByName('updated') : 0;
	}


	/**
	 *
	 * @param {String} table
	 * @param {String} fields
	 * @param {String} condition
	 * @param {String} limit
	 * @param {Function} callback
	 * @return {*}
   * @param sort
	 */
	function query_result(table, fields, condition, limit, sort, callback) {
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

		if (sort)
			q += ' order by ' + sort;

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

	function show_home(){
		var colors = [
				[153, 0, 51],
				[28, 160, 48],
				[201, 84, 31],
				[242, 160, 28],
				[0, 122, 118],
				[102, 0, 102]
		];
		var html = '', i = 0;
		var container = document.getElementById('news-container');
		container.innerHTML = '';
		query_result('news', 'title, thumb, substr(summary, 0, 150) as short_summary, link, updated', null, 6, 'updated desc', function (arr) {
			//alert(arr.short_summary);

			var new_elm = doc.createElement('article');
			new_elm.className = 'childnews news-item';
			new_elm.innerHTML = '<div class="news-image"><img src="' + arr.thumb + '" /></div><div class="news-title"><h1>' +
					arr.title + '</h1></div><div class="news-content" style="background-color: rgb(' + colors[i].join(',') + ');"><h1>' +
					arr.title + '</h1><p>' + arr.short_summary + ' ...</p></div>';
			container.appendChild(new_elm);
			//new_elm.getElementsByTagName('p')[0].innerHTML = arr.short_summary;
			i++;
		});

	}

	var categories_shown = false;
	win.toogle_categories = function(){
		categories_shown = !categories_shown;
		document.getElementById('left-pane').style.left = categories_shown ? '0' : '-250px';
	};

	win.select_category = function(name) {

	};

	function update_categories(){
		var html = '';
		for(var i=0; i<categories.length; ++i){
			html += '<a href="javascript:select_category(\'' + categories[i] + '\')">' + categories[i] + '</a>';
		}
		document.getElementById('category-list').innerHTML = html;

	}


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
					'summary':summary,
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
		fetch_news('http://the-marketeers.com/feed/atom', function (status, result) {
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
					alert(item.summary);
					if ((tmp = get_last_update(item.guid)) < updated) {
						//alert(q);
						try {
							var q = 'REPLACE INTO `news` (guid, title, link, thumb, categories, updated, fetched, read, summary, content) VALUES ' +
									"('{0}', '{1}',  '{2}', '{3}', '{4}',  '{5}', '{6}', '{7}',  '{8}',  '{9}');".format(
											item.guid, item.title.addSlashes(), item.link, item.img, item.categories.join(', ').addSlashes(), updated, now, 0, item.summary.addSlashes(), item.content.addSlashes()
									);
							db.execute(q);

							var insert_cat = [];
							for(var k=0; k < item.categories.length; ++k){
								if (categories.indexOf(item.categories[k]) === -1){
									insert_cat.push('("' + item.categories[k] + '")');
									categories.push(item.categories[k]);
								}
							}
							if (insert_cat.length > 0){
								db.execute('INSERT INTO `categories` (name) VALUES ' + insert_cat.join(', '));
							}
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

		show_home();
	};

})(window, document);