// ==UserScript==
// @name        Elite Dangerous Developer Postings
// @namespace   jojje/gm
// @include     http://forums.frontier.co.uk/*
// @include     https://forums.frontier.co.uk/*
// @version     2.4.5
// @downloadURL https://raw.githubusercontent.com/devjo/ed-dev-tracker/master/FDevPosts.user.js
// @updateURL   https://raw.githubusercontent.com/devjo/ed-dev-tracker/master/FDevPosts.user.js
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require     https://raw.githubusercontent.com/enyo/opentip/9026591955d3042ae22e2eadb0a8c51a4610a2fd/downloads/opentip-jquery.js
// ==/UserScript==

function log(){
  var c = window.console || typeof(console) != "undefined" ? console : {};
  if(c.debug) c.debug.apply(c, arguments);
}

function trigger() {
  var el = $('body');
  el.trigger.apply(el, arguments);
}
function on() {
  var el = $('body');
  el.on.apply(el, arguments);
}

function setBusy(busy) {
  if(busy) $('body').addClass('busy');
  else $('body').removeClass('busy');
}

function getColumnIndex(th) {
  if(th.jquery) th = th[0];
  return Array.prototype.slice.call(th.parentNode.children, 0).indexOf(th) + 1;
}

function getCellsForColumn(th) {
  return $(th).closest('table').find('tbody tr td:nth-child('+ getColumnIndex(th) +')');
}

// Calls an operation after a certain delay of
// there are a lot of posts on the page
function slowOperation(func, delay) {
  function manyPosts() {
    return $('#dev-posts tr').length > 500;
  }
  if( manyPosts() ) {
    return setTimeout(function() { // Allow for optional delay, so the scheduling
      setBusy(true);               // can be cancelled if needed (e.g. for typing).
      setTimeout(function() {      // Give the browser time to change
        func();                    // the cursor to busy-looking.
        setBusy(false);
      }, 50);
    }, delay || 0);
  } else func();
}
// Creates the table to draw the results in, or reuse it if it already exists.
function getOrCreatePostsTable() {
  var postsContainer = $('#dev-posts'), anchor, html;
  if(! postsContainer[0] ) {
    anchor = $('#breadcrumb');
    postsContainer = $('<div id="dev-posts"></div>');

    html = '<table>'+
             '<thead>'+
               '<th class="posted"><span>Posted</span></th>'+
               '<th class="author"><span>Author</span></th>'+
               '<th class="forum"><span>Forum</span></th>'+
               '<th class="thread"><span>Thread</span></th>'+
             '</thread>'+
             '<tbody></tbody>'+
           '</table>';

    $(html).appendTo(postsContainer);
    postsContainer.insertAfter(anchor);
  }
  return postsContainer;
}

function createTableHTML(posts) {
  function pad(n) {
    return n<10 ? '0'+n : ''+n;
  }
  function formatDate(utcStr) {
    var dt = new Date(utcStr),
        y  = pad( dt.getYear()+1900 ),
        m  = pad( dt.getMonth()+1 ),
        d  = pad( dt.getDate() ),
        h  = pad( dt.getHours() ),
        mi = pad( dt.getMinutes() );
    return y +'-'+ m +'-'+ d +' '+ h +':'+ mi
  }

  var html  = '';

  posts.forEach(function(post){
    var postUrl  = '/showthread.php?t='+ post.tid +'&p='+ post.pid +'#post'+ post.pid,
        forumUrl = '/forumdisplay.php?f='+ post.fid;
    html += '<tr>'+
             '<td class="post-date">'+ formatDate(post.posted) +'</td>'+
             '<td>'+
               '<div class="author" uid="'+ post.did +'" title="'+ post.author.title +'">'+ post.author.name +'</div>'+
             '</td>'+
             '<td class="forum"><a href="'+ forumUrl +'">'+ post.forum +'</a></td>'+
             '<td><a class="post" href="'+ postUrl +'">'+ post.thread +'</a></td>'+
           '</tr>';
  });
  return html;
}


// Renders a set of rows in the table, using the dev's role from the meta-info fetched previously
function render(posts) {
  posts.reverse();              // Default sorting order is descending posting time
  var html = createTableHTML(posts),
      body;
  if(html.length > 0) {
    tbody = getOrCreatePostsTable().find('tbody');
    $(html).appendTo(tbody);
    trigger('table.created');
    trigger('table.ready');
  } else {
    trigger('table.empty');
  }
}

function fetchAndRenderMeta() {
  function alreadyRendered() {
    return $('#dev-posts')[0];
  }

  if( alreadyRendered() ) {
    trigger('table.ready');
    return
  }
  $.getJSON('https://ed.apicrowd.org/ed/dev/posts.json').then(function(o) {
    var posts = denormalize(o, window.location.href);
    render(posts);
  }).fail(function(response){
    log("Failed to get metadata, HTTP response code: ", response.status);
  });
}

// Convert the efficient but cumbersome format used for network transmission
// into a format more apt to the domain application.
// It filters the posts to only those applicable to the user's currently viewed
// page (thread page or forum page)
function denormalize(o, currentPageUrl) {
  var posts = [], post, m, pid,
      curForumId, curThreadId;

  if (m=currentPageUrl.match(/forumdisplay.php\?f=(\d+)/)) {
    curForumId = +m[1];
  } else if(m=currentPageUrl.match(/showthread.php\?t=(\d+)/)) {
    curThreadId = +m[1];
    curForumId = +$('.lastnavbit')
        .prev('li')
        .find('a')
        .get()
        .map(function(a){ return a.href })
        .map(function(s){ return /f=(\d+)/.test(s) ? RegExp.$1  : '' })
        .filter(function(v){ return v })[0];
  }

  for(pid in o['posts']) {
    post = o['posts'][pid];

    if(!(curForumId == 29 || curForumId == post.fid || curThreadId == post.tid)) {
      continue;
    }

    post.author = o['devs'][post.did];
    post.thread = o['threads'][post.tid];
    post.forum  = o['forums'][post.fid];
    post.pid    = pid;
    posts.push(post);
  }
  return posts;
}

// Add some styling to the posts table and the button
function addCss(){
  function isTopForum() {
    return !!window.location.href.match(/[?&]f=29/);
  }
  var css = ''+
    '#fdev-button.no-posts { opacity: 0.2; }'+
    'body.busy, body.busy * { cursor: progress !important; }'+
    '#dev-posts table { margin: 0 0.5em; }'+
    '#dev-posts th {font-weight: bold; line-height: 1.5em; position: relative; min-width: 9em; }'+
    '#dev-posts td {padding-right: 1em; vertical-align: top; }'+
    '#dev-posts td a {text-decoration: none; }'+
    '#dev-posts .dev-role { font-size: 75%; font-style: italic; opacity: 0.5; }'+
    '#dev-posts .post-date { white-space: nowrap; }'+
    '#dev-posts { border: 1px dotted; padding: 0.6em; }'+
    '#dev-posts.hidden { display:none; }'+
    '#dev-posts td { padding-top: 0.2em; }'+
    '#dev-posts .author { cursor: default; white-space: nowrap; }'+
    '#dev-posts .forum a { white-space: nowrap; }'+
    '#dev-posts th span:after  { content: "\\2195"; font-size: 65%; left: 0.7em; opacity: 0.25; position: relative; top: -0.25em; }'+
    '#dev-posts th span:hover:after  { opacity: 1; }'+
    '#dev-posts th span { cursor: pointer; }'+
    '#dev-posts .filter-field { position: absolute; top: 0; left: 0; width: calc(100% - 2em); background: #555; }'+
    '#dev-posts .filtered { color: red; }'+
    '.opentip .ot-content { color: #E4E4E4; }'+
    '.opentip-container,.opentip-container *{-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.opentip-container{position:absolute;max-width:300px;z-index:100;-webkit-transition:-webkit-transform 1s ease-in-out;-moz-transition:-moz-transform 1s ease-in-out;-o-transition:-o-transform 1s ease-in-out;-ms-transition:-ms-transform 1s ease-in-out;transition:transform 1s ease-in-out;pointer-events:none;-webkit-transform:translateX(0) translateY(0);-moz-transform:translateX(0) translateY(0);-o-transform:translateX(0) translateY(0);-ms-transform:translateX(0) translateY(0);transform:translateX(0) translateY(0)}.opentip-container.ot-fixed.ot-going-to-show.stem-top.stem-center,.opentip-container.ot-fixed.ot-hidden.stem-top.stem-center,.opentip-container.ot-fixed.ot-hiding.stem-top.stem-center{-webkit-transform:translateY(-5px);-moz-transform:translateY(-5px);-o-transform:translateY(-5px);-ms-transform:translateY(-5px);transform:translateY(-5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-top.stem-right,.opentip-container.ot-fixed.ot-hidden.stem-top.stem-right,.opentip-container.ot-fixed.ot-hiding.stem-top.stem-right{-webkit-transform:translateY(-5px) translateX(5px);-moz-transform:translateY(-5px) translateX(5px);-o-transform:translateY(-5px) translateX(5px);-ms-transform:translateY(-5px) translateX(5px);transform:translateY(-5px) translateX(5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-middle.stem-right,.opentip-container.ot-fixed.ot-hidden.stem-middle.stem-right,.opentip-container.ot-fixed.ot-hiding.stem-middle.stem-right{-webkit-transform:translateX(5px);-moz-transform:translateX(5px);-o-transform:translateX(5px);-ms-transform:translateX(5px);transform:translateX(5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-bottom.stem-right,.opentip-container.ot-fixed.ot-hidden.stem-bottom.stem-right,.opentip-container.ot-fixed.ot-hiding.stem-bottom.stem-right{-webkit-transform:translateY(5px) translateX(5px);-moz-transform:translateY(5px) translateX(5px);-o-transform:translateY(5px) translateX(5px);-ms-transform:translateY(5px) translateX(5px);transform:translateY(5px) translateX(5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-bottom.stem-center,.opentip-container.ot-fixed.ot-hidden.stem-bottom.stem-center,.opentip-container.ot-fixed.ot-hiding.stem-bottom.stem-center{-webkit-transform:translateY(5px);-moz-transform:translateY(5px);-o-transform:translateY(5px);-ms-transform:translateY(5px);transform:translateY(5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-bottom.stem-left,.opentip-container.ot-fixed.ot-hidden.stem-bottom.stem-left,.opentip-container.ot-fixed.ot-hiding.stem-bottom.stem-left{-webkit-transform:translateY(5px) translateX(-5px);-moz-transform:translateY(5px) translateX(-5px);-o-transform:translateY(5px) translateX(-5px);-ms-transform:translateY(5px) translateX(-5px);transform:translateY(5px) translateX(-5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-middle.stem-left,.opentip-container.ot-fixed.ot-hidden.stem-middle.stem-left,.opentip-container.ot-fixed.ot-hiding.stem-middle.stem-left{-webkit-transform:translateX(-5px);-moz-transform:translateX(-5px);-o-transform:translateX(-5px);-ms-transform:translateX(-5px);transform:translateX(-5px)}.opentip-container.ot-fixed.ot-going-to-show.stem-top.stem-left,.opentip-container.ot-fixed.ot-hidden.stem-top.stem-left,.opentip-container.ot-fixed.ot-hiding.stem-top.stem-left{-webkit-transform:translateY(-5px) translateX(-5px);-moz-transform:translateY(-5px) translateX(-5px);-o-transform:translateY(-5px) translateX(-5px);-ms-transform:translateY(-5px) translateX(-5px);transform:translateY(-5px) translateX(-5px)}.opentip-container.ot-fixed .opentip{pointer-events:auto}.opentip-container.ot-hidden{display:none}.opentip-container .opentip{position:relative;font-size:13px;line-height:120%;padding:9px 14px;}.opentip-container .opentip .header{margin:0;padding:0}.opentip-container .opentip .ot-close{pointer-events:auto;display:block;position:absolute;top:-12px;left:60px;color:rgba(0,0,0,.5);background:0 0;text-decoration:none}.opentip-container .opentip .ot-close span,.opentip-container .opentip .ot-loading-indicator{display:none}.opentip-container.ot-loading .ot-loading-indicator{width:30px;height:30px;font-size:30px;line-height:30px;font-weight:700;display:block}.opentip-container.ot-loading .ot-loading-indicator span{display:block;-webkit-animation:otloading 2s linear infinite;-moz-animation:otloading 2s linear infinite;-o-animation:otloading 2s linear infinite;-ms-animation:otloading 2s linear infinite;animation:otloading 2s linear infinite;text-align:center}.opentip-container.style-alert .opentip,.opentip-container.style-dark .opentip{color:#f8f8f8;text-shadow:1px 1px 0 rgba(0,0,0,.2)}.opentip-container.style-glass .opentip{padding:15px 25px;color:#317cc5;text-shadow:1px 1px 8px rgba(0,94,153,.3)}.opentip-container.ot-hide-effect-fade{-webkit-transition:-webkit-transform .5s ease-in-out,opacity 1s ease-in-out;-moz-transition:-moz-transform .5s ease-in-out,opacity 1s ease-in-out;-o-transition:-o-transform .5s ease-in-out,opacity 1s ease-in-out;-ms-transition:-ms-transform .5s ease-in-out,opacity 1s ease-in-out;transition:transform .5s ease-in-out,opacity 1s ease-in-out;opacity:0.89;-ms-filter:none;filter:none}.opentip-container.ot-hide-effect-fade.ot-hiding{opacity:0;filter:alpha(opacity=0);-ms-filter:"alpha(Opacity=0)"}.opentip-container.ot-show-effect-appear.ot-going-to-show,.opentip-container.ot-show-effect-appear.ot-showing{-webkit-transition:-webkit-transform .5s ease-in-out,opacity 1s ease-in-out;-moz-transition:-moz-transform .5s ease-in-out,opacity 1s ease-in-out;-o-transition:-o-transform .5s ease-in-out,opacity 1s ease-in-out;-ms-transition:-ms-transform .5s ease-in-out,opacity 1s ease-in-out;transition:transform .5s ease-in-out,opacity 1s ease-in-out}.opentip-container.ot-show-effect-appear.ot-going-to-show{opacity:0;filter:alpha(opacity=0);-ms-filter:"alpha(Opacity=0)"}.opentip-container.ot-show-effect-appear.ot-showing,.opentip-container.ot-show-effect-appear.ot-visible{opacity:0.89;-ms-filter:none;filter:none}@-moz-keyframes otloading{0%{-webkit-transform:rotate(0deg);-moz-transform:rotate(0deg);-o-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg)}}@-webkit-keyframes otloading{0%{-webkit-transform:rotate(0deg);-moz-transform:rotate(0deg);-o-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg)}}@-o-keyframes otloading{0%{-webkit-transform:rotate(0deg);-moz-transform:rotate(0deg);-o-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg)}}@-ms-keyframes otloading{0%{-webkit-transform:rotate(0deg);-moz-transform:rotate(0deg);-o-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes otloading{0%{-webkit-transform:rotate(0deg);-moz-transform:rotate(0deg);-o-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg)}}'+
    '.opentip-container { max-width: 30em; }';
  if(!isTopForum()) css += '#dev-posts .forum { display:none; }';
  $('<style id="fdev-style" type="text/css">'+ css +'</style>').appendTo('body');
}

// Allow a sneak peek at what the author posted when hovering
// over the related thread title instance that links to the post.
function addPreviewListener() {
  function isThreadUrl(url) {
    return url.match(/showthread\.php/);
  }
  function extractPost(html, url) {
    var doc = document.createElement('div'), postBody,
        postName = url.split("#")[1];
    // disable loading of images when browser creates the DOM elements
    html = html.replace(/(<img\s.*?)src="([^"]+)"(.*?>)/g, '$1 src-data="$2" $3');
    doc.innerHTML = html;
    postBody = $('a[name='+ postName +']', doc).closest('li').find('.postbody .postcontent');
    postBody.find('img').each(function(){
      this.src = this.getAttribute('src-data');   // Restore the images for the snippet we're interested in
    });
    html = postBody.html();
    doc.innerHTML = '';
    return html;
  }

  // Let's intercept and pre-process the responses to tooltip's Ajax requests,
  // and extract the data we want it to show before letting it add the content
  // to the actual tooltip
  var origAjax = $.ajax;
  $.ajax = function(settings){
    return origAjax.apply($, arguments).then(function(html, status, xhr){
      if( isThreadUrl(settings.url) ) {
        html = extractPost(html, settings.url);
      }
      // Add required forum style class to fix the text color.
      return '<div class=".postrow">'+ html +'</div>';
    });
  }

  Opentip.styles.tag = {
    ajax: true,             // The URL to download will be taken from the href attribute
    target: true,           // Takes the link element as target
    tipJoint: 'left',       // So the tooltip floats right of the thread title
    background: 'black',
    shadow: false,
    delay: 0.5,
    borderColor: '#ff3b00', // Make the border match the forum color
    group: 'tags'           // Ensures that only one tag Opentip is visible
  };

  $('#dev-posts .post').each(function() {
    new Opentip(this, { style: "tag" });
  });

  log('preview handlers added');
}

function addSortListener() {
  function sortByColumnIndex(colIdx, ascending) {
    var flip = ascending ? 1 : -1,
        sortedRows = $('#dev-posts tbody tr td:nth-child('+ colIdx +')')
        .get().map(function(el){
          return [el.textContent.toLowerCase(), el];   // Optimization, so we don't need to do redundant toLowerCase in the sort loop
        })
        .sort(function(a,b){
          a = a[0]; b = b[0];                          // Sort on the prepared strings
          return a < b ? -1*flip : a > b ? 1*flip : 0; // Sign flip provides the asc and desc ordering mechanism
        }).map(function(strTd){
          return strTd[1].parentNode;                  // Return the actual rows (tr), since that's what we'll re-arrange in the DOM
        });
    $('#dev-posts tbody').append(sortedRows);          // Let jquery and the browser efficiently carry out the actual row rearrangement
  }

  $('#dev-posts th span').click(function(evt){
    var header = $(evt.target).closest('th')[0], sort,
        colIdx = getColumnIndex(header),
        state  = $('#dev-posts').data('sort-state') || {sortcol: null, ascending: true};

    // Make it so that sorting is only reversed if the column clicked was the same as the column last clicked.
    // If column is different from previous sort (or is the first sort), do ascedning sort.
    if(state.sortcol == colIdx) {
      state.ascending = ! state.ascending;
    } else {
      state.ascending = true;
    }
    state.sortcol = colIdx;

    sort = function(){
      sortByColumnIndex(colIdx, state.ascending);
    };

    slowOperation(sort);    // Only show the "oh how slow my cumputer is" icon if the sort time is projected to be noticeable

    $('#dev-posts').data('sort-state', state);
  })
  .on('mousedown', function(evt){                      // Prevent fast toggling from being annoying by selecting text.
    evt.preventDefault();
  });
}

function addFilterListener() {
  function hideMatchingIn(column, filter) {
    var cells = getCellsForColumn(column),
        tbody = cells.first().closest('tbody'),
        rows  = tbody.children();

    cells.removeClass('col-hide');
    cells.filter(function(){                     // Find the rows that do *not* match the filter
      return this.textContent.toLowerCase()
             .indexOf(filter) == -1;
    })
    .addClass('col-hide');                       // .. and mark them as a satisfied condition for hiding the row

    rows.removeClass('hidden')
    .children('.col-hide')
    .parent('tr')
    .addClass('hidden');
  }

  function createInputField(header) {
    var timer, keycodes = [
      16 /* shift */, 17 /* ctrl */, 18 /* alt */, 91 /* meta */, 27 /* esc */, 13 /* enter */
    ];
    return $('<input class="filter-field textbox" type="text">')
    .appendTo(header)
    .keydown(function(evt) {
      if(evt.keyCode == 13 || evt.keyCode == 27) {
        $(this).hide();
      }
    })
    .keyup(function(evt) {
      if (keycodes.indexOf(evt.keyCode) >= 0) return;
      var filter = $(this).val().toLowerCase().trim();

      if(filter.length == 0) header.removeClass('filtered')
      else header.addClass('filtered')

      clearTimeout(timer);
      timer = slowOperation(function(){       // The operation can be slow with lots of rows, so
        hideMatchingIn(header, filter);       // wait until the user pauses typing to update in that case
      }, 500);
    });
  }

  $('#dev-posts th span').click(function(evt){
    var header, field;
    if(! (evt.altKey || evt.shiftKey) ) return;
    evt.stopImmediatePropagation();                // we got this, prevent sorting from triggering

    header = $(evt.target).closest('th');

    field = header.find('.filter-field');
    if(! field[0] ) field = createInputField(header);

    field.show().focus();
  });
}

// Add the clicky button that toggles showing and hiding of the dev posts
function addDevPostsButton(){
  var button = $('<li id="fdev-button"><a href="devposts.php" class="navtab">Dev Posts</a></li>')
  .appendTo('#navtabs')
  .click(function(evt){
    evt.preventDefault();
    if( button.hasClass('no-posts') ) {
      return evt.preventDefault();
    }
    if( $('#dev-posts').is(':visible') ) { // If posts table is visible
      trigger('hide.posts');               // Hide it
    } else {
      trigger('show.posts');
    }
  });

  on('hide.posts', function(){
    $('#dev-posts').addClass('hidden');
    button.removeClass('selected');
    $('#navtabs .selected-off').removeClass("selected-off")
                                  .addClass("selected");
  });
  on('show.posts', function(){
    $('#navtabs .selected').removeClass("selected")
                              .addClass("selected-off");
    button.addClass('selected');
    setBusy(true);
    fetchAndRenderMeta();
  });
  on('table.ready', function() {
    var cPosts = $('#dev-posts tbody tr').length;
    $('#dev-posts').removeClass('hidden');
    button.attr('title',''+ cPosts +' post' + (cPosts > 1 ? 's' : '') );
    setBusy(false);
  });
  on('table.empty', function() {
    button.addClass('no-posts');
    button.attr('title','No dev posts in here');
    setBusy(false);
  });
  on('table.created', function() {
    addPreviewListener();
    addFilterListener();
    addSortListener();
  });
}

function isAppropriatePageForButton() {
  return window.location.pathname.match(/^\/(forumdisplay|showthread)\.php/);
}

if( isAppropriatePageForButton() ) {
  addCss();
  addDevPostsButton();
}