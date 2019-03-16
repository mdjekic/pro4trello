var boardId;
var boardSettings;

function updateSettings() {
  // handle checkboxes
  $('input[type="checkbox"]').each(function () {
    let checkbox = jQuery(this);
    boardSettings[checkbox.attr('name')] = checkbox.prop('checked');
  });

  // handle text inputs
  $('textarea,input[type="text"]').each(function () {
    let textarea = jQuery(this);
    boardSettings[textarea.attr('name')] = textarea.val();
  });

  // handle select/radio buttons
  $('.radio-group').each(function () {
    let radio = jQuery(this).find('input').filter(':checked');
    boardSettings[radio.attr('name')] = radio.val();
  });

  let storage = {};
  storage[boardId] = boardSettings;
  chrome.storage.sync.set(storage);
}

function loadSettings() {
  boardId = window.location.hash.replace('#b=','');
  chrome.storage.sync.get(['defaults',boardId], function (globalSettings) {
    boardSettings = globalSettings[boardId];

    if(boardSettings) {
      for (let key in boardSettings) {
        // try checkbox
        let checkbox = $('input[type="checkbox"][name="' + key + '"]');
        if (checkbox.length != 0) {
          if (boardSettings[key]) {
            checkbox.attr('checked', true);
            checkbox.parents('.checklist-item').addClass('checklist-item-state-complete');
          }
          else {
            checkbox.removeAttr('checked');
            checkbox.parents('.checklist-item').removeClass('checklist-item-state-complete');
          }
          continue;
        }

        // try textarea, text input
        let textarea = $('[name="' + key + '"]');
        if (textarea.length != 0) {
          textarea.val(boardSettings[key]);
          continue;
        }

        // try radio
        let radio = $('input[type="radio"][name="' + key + '"][value="' + boardSettings[key] + '"]');
        if(radio.length != 0) {
          radio.attr('checked',true);
          continue;
        }
      }
    } else {
      boardSettings = {};
    }
  });
}

$(function(){

  loadSettings();

  $('input[type="checkbox"],input[type="radio"]').on('change',updateSettings);
  $('tinput[type="text"],extarea').on('input',updateSettings);

});
