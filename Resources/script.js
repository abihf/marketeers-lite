
(function (win, doc) {
	"use strict";
	var Ti = win.Ti;

	alert(win.localStorage);

	//Open the database first
	var db = Ti.Database.open('news');
			//Ti.Database.openFile(Ti.Filesystem.getFile(Ti.Filesystem.getApplicationDataDirectory(), 'news.db'));

	//Create a table and insert values into it
	db.execute("CREATE TABLE IF NOT EXISTS `news` ( \
  `id` int unsigned NOT NULL AUTO_INCREMENT, \
  `guid` varchar(128) NOT NULL, \
  `title` varchar(256) NOT NULL, \
  `link` varchar(256) NOT NULL, \
  `updated` datetime NOT NULL, \
  `summary` tinytext NOT NULL, \
  `content` text NOT NULL, \
  `thumb` varchar(256) NOT NULL, \
  `read` tinyint(1) NOT NULL, \
	PRIMARY KEY (`id`), \
	UNIQUE KEY `guid` (`guid`) \
	) AUTO_INCREMENT=1 ;");
	//db.execute("INSERT INTO Users VALUES(1,'Joe Bloggs')");

	//Select from Table
	/*
	var rows = db.execute("SELECT * FROM Users");
	while (rows.isValidRow()) {
		//Alert the value of fields id and firstName from the Users database
		alert('The user id is '+rows.fieldByName('id')+', and user name is '+rows.fieldByName('firstName'));
		rows.next();
	}

	//Release memory once you are done with the resultset and the database
	rows.close();
	db.close();
	*/

	function guid_exist(guid, last_updated){
		if (last_updated) last_updated = " AND `updated` < " + last_updated;
		else last_updated = '';
		var rows = db.execute("SELECT * FROM `news` WHERE guid = '" + guid + "'" + last_updated + ' LIMIT 1');
		return (rows && rows.rowCount() > 0);
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
					'id':id,
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

	function sync() {
		fetch_news('http://www.sambadhacare.test/feed/atom', function (status, result) {
			if (status) {
				var html = [];
				html.push('<table>');
				for (var i = 0; i < result.length; i++) {
					html.push('<tr>');
					for (var j in result[i]) {
						if (result[i].hasOwnProperty(j)) {
							html.push('<td>' + result[i][j] + '</td>');
						}
					}
					html.push('</tr>');
				}
				html.push('</table>');
				document.getElementById('sync-result').innerHTML = html.join('');
			}
		});
	}

})(window, document);