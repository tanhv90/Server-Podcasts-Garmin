const READ= 'r';
const SYNC= 's';


function chg() {
    var name = window.location.pathname.endsWith('opml') ? 'opml': 'rss';
    if ( $('#' + name).val().trim() ) {
        $('#details').show();
        $("button").show();
        $('#podLoad').show();
    } else {
        $('#details').hide();
        $("button").hide();
        $('#podLoad').hide();
    }
    return false;
}


function debug () {
    if (window.DBG) {
        console.log(arguments);
    }
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
  }

// ------- gestion archi --------
$('body').ready( () => {   
    tablo = window.location.pathname.split('/')
    last = tablo[tablo.length-1]
    
    if ( last.match(/[0-9]+/)) {
         readyPage(tablo.slice(0, -1).join('/'));
    }
    else {
        readyPage(window.location.pathname);
    }
    
} );

async function error(ret, iframe = false) {
    console.error('error : ', iframe, ret )
    if (iframe) {
        //var ret = {'code': ret.status, 'data':  JSON.stringify(ret.data) };
        //$('#details').append('<iframe src="/error?&&code='+ret.code+'" width="200px" height=300px"" ></iframe>');
    }
    else {
//        window.location.href = '/error?&code='+ret.code+'&data='+JSON.stringify(ret.data);
     }
}

async function goto(pat) {
    debug('goto = ', pat)

    path = pat ? pat : '/home';
    path = path === '/' ? '/home' : path;
    if  (window.location.pathname != path) {
        window.location.href = path;
    } else {
        window.location.reload();
    }
}

function readyPage(path) {
    debug('ready=', path );
    switch(path) {
        case '/podcasts/opml':
        case '/rss':
        case '/':
        case '/logout':
        case '/login':
        case '/create_user':
        case '/podcast'  :
        case '/podcast/add':
        case '/home':
            pageTT();
            break;

        case '/micro' :
        case '/mini':
        case '/error': break;

        default:
            error( {
                'code' : 404,
                'data' :' Page not found ! ('+path +')'
            })
        }
}

// =========================== id

function secondToString(sec) {
    var s = parseInt( sec );
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;
    return  (hrs <= 0 ? '' : hrs + 'h ') +
                    (mins <10 ? '0': ' ') + mins  + " min " +
                    (secs <10 ? '0': ' ') + secs  + " sec" ;
}

function millisecondToString( ms ) {
    var millisecond = parseInt( ms) ;
    var date = new Date(parseInt(millisecond));
    var options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };
    return date.toLocaleDateString("fr-FR", options);
}

function insertTime () {
    $('.dur').each( (index, elt) => {
        var this$ = $(elt);
        this$.text( '  '+ secondToString( this$.text().trim() ));
        this$.removeClass('dur');
    });     

    $('.pub').each( (index, elt) => {
        var this$ = $(elt);
        this$.text( '  '+millisecondToString( this$.text().trim() ));
        this$.removeClass('pub');
    });
}

function showAll() {
    // @TODO or not ??

}
   
async function allRead(pod) {
    await doIt('/episode/readed', - pod);
    window.location.reload();
}

async function noneRead(pod) {
    await doIt('/episode/not_readed', - pod);
    window.location.reload();
}

async function allSync(pod) {
    await doIt('/episode/sync_watch', - pod);
    window.location.reload();
}

async function noneSync(pod) {
    await doIt('/episode/not_sync_watch', - pod);
    window.location.reload();
}

async function doIt(url, id) {
    var formData = new FormData();
    formData.append("ids", id);
    var request = new Request(url, {method: 'POST', body: formData});

    try {
        var response = await fetch(request)
        debug('retour doIt', response);
        return response;
    }
    catch (e) {
        console.error('doIt', e);
        return false;
    }
}

async function toggle(mode, id) {
    var cl = (mode === 's'? 'synced' : 'read');
    var art$ = $('#'+mode+id);
    var chk2uncheck = art$.hasClass('checked') ;
        
    var url = chk2uncheck ?
        (mode === 's' ?  '/episode/not_sync_watch' : '/episode/not_readed'):
        (mode === 's' ?  '/episode/sync_watch'     : '/episode/readed')
        ;
    
     try { 
        var res = await doIt(url, id);
        debug( 'toggle/doIt', res);
    
        if (res.ok) {
            window.location.reload();
        } else {
            console.error('doIt not ok', res)
        }
    }   catch (e) {
            console.error('doIt', e);
    } finally {
        return false
    }
}

async function audioDone(ep_id) {
    await toggle(READ, ep_id);
    $('audio'). not (document.getElementById( '#audio_' + ep_id)).show();
}

function audioPause(ep_id) {
    $('audio'). not (document.getElementById( '#audio_' + ep_id)).show();
}

function audioRun(audio_id){
    $('audio'). not (document.getElementById( audio_id)).hide();
}


// ========================== OPML

var numPod = 0;
var ok = 0;
var total = 0;
var fichier = null;
var nbpods = 0;

function updPods() {
    initOpml();
    fichier = this.files[0];
    if (fichier) {
        $("#infos").show();
        return chg();
    }
    return false
}

function initOpml() { 
    numPod = 0;
    ok = 0;
    errors = 0;
    
    var podLoaded$ = $("#podLoad");
    podLoaded$.attr('max', nbpods);
    podLoaded$.val(0);

    return chg();
}

function mkOpml(txt) {
    debug('mkOpml', txt);
    var pod = {};
    var res = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opml version="1.0">'+
        '<head><title>Export OPML (MyPodcasts)</title></head><body>'
    for (var i=0, mx = txt.length; i<mx; i++) {    
        pod = txt[i];
        res += '<outline type="rss" text="'+pod.title+
            '" title="'+pod.title+'" xmlUrl="'+pod.rss_url+'" htmlUrl="'+pod.html_url+'" />'
    }
    res += '</body></opml>'

    return res;
}

async function getOPML() {
    var from$ = $('#export');
    from$.addClass('fa-bounce');

    var headers = new Headers();
    headers.append('Accept', 'application/json');
    var data = new FormData();

    var request = new Request('/podcasts/export' , {
        method: 'POST',
        headers: headers,
        body: data        
      });
    try {
        var response = await fetch(request);
        debug('export',response)
        if (response.ok) {
           var txt = await response.json();
           var xml = mkOpml(txt);
           download('myPodcasts_ompl_'+Date.now()+'.xml', xml);
        }
    } catch(err) {
        console.error(err);
    }
    finally {
        from$.removeClass('fa-bounce');
    }
}

function podsAdd() {
    initOpml();
    $('#infos').hide();
    $('button').hide();
    $('#clicked').show();
    $("#details").empty();

    var opml = $('#opml').val().trim();
    if ( opml ) {
              
        const fr = new FileReader();

        fr.readAsText( fichier );

        fr.onloadend = async () => {
                
            var xmlDoc = new window.DOMParser().parseFromString(fr.result, "text/xml");
            var outlines= xmlDoc.getElementsByTagName("outline");
            nbpods = outlines.length;

            $('#podLoad').show().val(0);
            $('#ok').html('<span>'+ ok + ' / '+ nbpods + ' Ok, (' + errors + ' Errors ) </span>' );   
            
            initOpml();                                                               
            $("#infos").show();
            $('button').hide();
                
            try {
                if (nbpods) {
     
//                    var res = [];

                    for (numPod = 0; numPod < nbpods; numPod++) {
//                          res.push( 
                              await podSub( 
                                numPod,
                                rss = outlines[numPod].getAttribute('xmlUrl')
                                );
                    }
//                    await Promise.all (res)
                } 
            }  catch (e)  {
                console.error('error loop',e, outlines[numPod]);
                $("#details").append('<p>Error loop : '+JSON.stringify(e) +'<br/> nb Pods = '+
                                        numPod +'<br/> XmlUrl = '+ JSON.stringify(outlines[numPod])+ '</p>');
            } finally {
                $('#clicked').hide();    
                $('button').show();
                return false;                
            }
        }
    } else {
        $('#clicked').hide();    
        $('button').show();    
        $("#infos").show();
        $('#podLoad').hide();
        $('#ok').empty().append ('<span class="warning" style="color:tomato;"> Vous DEVEZ fournir un fichier OPML</span>')
    }
    return false;
}


// ------- gestion home -------           
async function podcastRemove(id) {
    var request = new Request('/podcast/remove/' + id  , {method: 'POST'});
    try {
        response = await fetch(request);
        if (response.ok) {
            $('#' + id).remove();
        }
    } catch(err) {
        console.error(err);
    }
}

async function _refreshOne(id) {
    var request = new Request('/check_this_podcast/'+id, {method: 'POST'});
    try {
        response = await fetch(request);
        if (response.ok) {
            return await response.json()
        } else {
            return {
                "status" : response.code,
                "code"   : response.code, 
                "data"   : response.json(),
                "ok"     : false
            }   
        }
    } catch(er) {
        console.error(er);
    }
}


async function _refresh() {
    var request = new Request('/check_new_episodes', {method: 'POST'});
    try {
        response = await fetch(request);
        if (response.ok) {
            return await response.json()
        } else {
            return {
                "status" : response.status,
                "code"   : response.status, 
                "data"   : response.text()
            }   
        }
    } catch(er) {
        console.error(er);
    }
}

async function refresh() {
    try {
        response = await _refresh();
        if (response.ok) {
            window.location.reload();
        }
    } catch (er) {
        console.error(er);
    }
}


// ------- gestion opml --------
async function podSub(numPod, rss = '') {
    debug('podSub: ', arguments);

    var jrsp = null;
    var response = null;

    var headers = new Headers();
    headers.append('Accept', 'application/json');

    var formData = new FormData();
    formData.append("rss", rss.trim());

    var image = '/static/notyet.png'
    var toInsert ='Erreur inconnue'
    var titre = rss
    

    var request = new Request('/podcast/add', {
        method: 'POST',
        headers: headers,
        body: formData
    });

    try {

        response = await fetch(request);

        if (response) {
            jrsp = await response.json();   
            titre = jrsp.title;
            image = jrsp.image;

            if (response.ok) {
                ok++;
            }
            else   {
                errors++; 
            }

            toInsert = '<div class="container row  debut gap5">'+
            '<span class="vignette rigid ">'+
                '<img class="vignette rigid centre milieu" src="'+image+'" />'+
            '</span>'+
            '<h1 class="title debut milieu">  '+titre +'</h1>'+
            '<span class="spacer mini rigid"></span>'+
            '<span class="centre milieu" style="font-weight:bold;color:'+
                ( response.ok ?
                    'darkgreen;" ><i class="fas fa-check"></i>  Ok ':
                    'tomato;" ><i class="fas fa-times fa-2x "></i>  Erreur : '+ JSON.stringify(jrsp) ) +
            '</span>'+
            '</div>'+
            '<div class="spacer">'  ;
        }

        $('#details').append(toInsert);
     
        $('#podLoad').val(numPod+1);
        $('#ok').html('<span>'+ ok + ' / '+ nbpods + ' Ok, (' + errors + ' Errors ) </span>' );   

    } catch(e) { 
        console.error('podSub', e);

    } finally {
        return false;
    }
}


// ========================== RSS
async function podAdd() {
    var rss = $('#rss').val().trim();

    var response;
    var jrsp = {};
    var headers = new Headers();
    headers.append('Accept', 'application/json');
    var formData = new FormData();
    formData.append("rss", rss);

    $('button').hide();
    $('#clicked').show();

     if (rss) {        
        try {
            $("#details").empty();

            var request = new Request('/podcast/add', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            response = await fetch(request);

            if (response) {
                jrsp = await response.json();   
                titre = jrsp.title;
                image = jrsp.image;
    
                if (response.ok) {

                    $("main")
                    .append('<iframe src="/mini/'+jrsp.id+'"  ></iframe>');                    
                } 
                else {
                    console.error('podadd error> ', jrsp)             
                    $('#details')
                    .show()
                    .html('<span style="font-weight:bolder;color:tomato;">Erreur ' +
                            response.status+' :'+
                            response.statusText + '</span>')  ;
                }
            }

        } catch (err) {
                console.error('Exception = ', err);
                $('#details')
                    .show()
                    .html('<span style="font-weight:bolder;color:tomato;">Error ' +
                    err.status+' : '+ err.statusText +' </span >');
        } finally {
               $('button').show();
               $('#clicked').hide();
                return false;
        }        
    }
    else {
        $('button').show();
        $('#clicked').hide();
        $('#details')
        .html('<span style="font-weight:bolder;color:tomato;">Vous DEVEZ fournir l\'URL du fichier RSS du podcast</span> ')
        .show()
        return false;
    }
}

// ------- gestion tooltips --------
function focOut(ev) {
    debug("out", ev);
    $(".ttip").remove();
    return false;
}

function focIn(ev) {
    debug("in", ev);
    if ($('.ttip').length > 1) {
        $(".ttip").remove();
    }
    var  targ$ = $(ev.currentTarget);
    if (targ$.is('.del')) {
        return false;
    }
    targ$.mouseout( focOut);
    targ$.after('<div class="ttip" >'+ targ$.attr("alt") +'</div >');

    $('.ttip').click( () => {
       var a = targ$.closest('a');
       var o = targ$.closest('[onclick]');
       if (a || o) {
           (a.length ? a : o).click();
       }
   })

    return false;
}

async function pageTT() {
    const retardIn  = 150;
    var toIn;
    var tar = null;

    $('.ttip').remove();
    
    $('[alt]').mouseenter( (ev) => {
        if (tar !== ev.currentTarget) {
            tar = ev.currentTarget;
            toIn = setTimeout( () => {
                return focIn(ev);
            }, retardIn);
        }

        return false;
    });
}
