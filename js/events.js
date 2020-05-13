// listen to install/update events
chrome.runtime.onInstalled.addListener(function(details){
	switch(details.reason) {
		case 'install':
			chrome.tabs.create({url: '/docs/pro-for-trello-installed.html'});
			break;
		case 'update':
			var version = chrome.runtime.getManifest().version;

			// special cases
			if(version == '2.0.1') {
				chrome.tabs.create({url: '/docs/pro-for-trello-updated-to-2.0.html'});
				break;
			} else if(version == '3.2.1') {
				let migrateToLocal = () => {
					// migrate all settings and data to local storage, thank you Google :(
					chrome.storage.sync.get(function(data){
						chrome.storage.local.set(data);
					});
				};				
				migrateToLocal();
			}

			if(version.split('.').length > 2) break; // ignore minor versions
			chrome.tabs.create({url: '/docs/pro-for-trello-updated-to-'+version+'.html'});
			break;
	}
});