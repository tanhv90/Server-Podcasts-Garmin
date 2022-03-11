#! /Library/Frameworks/Python.framework/Versions/3.8/bin/python3.8
# -*- coding: utf-8 -*-

from pickle import LONG_BINGET
from flask import Flask
from flask import request
from flask import render_template
from flask import Response
from flask import redirect
from flask import session
from flask_accept import accept
from flask_caching import Cache

from functools import wraps
import os
import threading
import json
import manager_podcast
import api_podcasting_index


import config

from datetime import datetime

configuration_flask = {
    "CACHE_TYPE": "simple",  # Flask-Caching related configs
    "CACHE_DEFAULT_TIMEOUT": 300
}

lock = threading.Lock()
app = Flask(__name__)
app.secret_key = 'ed9e80f235a0c0ea6d945efc87f16c88e4a6b47a'
app.config.from_mapping(configuration_flask)
cache = Cache(app)


@app.before_first_request
def before_first_request():
    if config.ACTIVE_LOG:
        print("before_first_request")
    session['user'] = ""
    manager_podcast.create_database()
    manager_podcast.check_new_episodes()


def require_user_id(func):
    @wraps(func)
    def check_token(*args, **kwargs):
        user_id = None
        
        if request.headers.get('Authorization') != None:
            user_id = manager_podcast.user_id(request.headers.get('Authorization'))
        elif 'session_token' in session:
            user_id = manager_podcast.user_id(session['session_token'])
            if user_id != None:
                session['user'] = manager_podcast.user_pseudo(session['session_token'])


        if user_id != None:
            kwargs['user_id'] = user_id
            return func(*args, **kwargs)
        else:
            if(request.headers.get("Accept") == 'application/json'):
                return Response(json.dumps({'error': 'Access denied'}), status=401, mimetype='application/json')
            else:
                return redirect("/login")
    return check_token

@app.route('/podcasts/opml', methods=['GET'])
@accept('text/html')
@require_user_id
def web_ui_podcast_add_opml(user_id):
    return render_template("podcasts-add-opml.html")


@app.route('/podcasts/export', methods=['POST'])
@accept('application/json')
@require_user_id
def web_podcast_export_opml(user_id):
     podcasts =  manager_podcast.list_podcast(user_id, True)
     return Response(json.dumps(podcasts), status=200, mimetype='application/json')

@app.route('/podcast/search', methods=['GET'])
@accept('application/json')
@require_user_id
@cache.cached(timeout=86400, query_string=True)
def get_search_podcast(user_id):
    name = request.values.get("name")
    if config.ACTIVE_LOG:
        print("name : "+str(name))
    if(name is None):
        return Response(json.dumps({'error': 'missing parameter'}), status=400, mimetype='application/json')
    elif os.environ['PODCASTING_INDEX_KEY'] in (None, ''):
        return Response(json.dumps({'error': 'missing API KEY'}), status=401, mimetype='application/json')
    else:
        return Response(json.dumps(api_podcasting_index.search_22(name)), status=200, mimetype='application/json')


@app.route('/podcast/add', methods=['POST'])
@accept('application/json')
@require_user_id
def post_add_podcast_rss(user_id):
    rss_url = request.values.get("rss")

    if config.ACTIVE_LOG:
        print('------- add_podcast> ')
        print('------- add_podcast> user_id : ' + str(user_id))
        print('------- add_podcast> rss_url : ' + str(rss_url))

    if rss_url == None:
        return Response(json.dumps({"code": manager_podcast.StatusCode.ERROR , "data": 'missing parameter'}), status=400, mimetype='application/json')
    else:
       
        if config.ACTIVE_LOG:
            print('------- add_podcast> launched at ', datetime.now())

        res = manager_podcast.add_podcast_rss(user_id=user_id, rss_url=rss_url)
        if config.ACTIVE_LOG:
           print("podadd res : " + str(res))
           print('------- add_podcast> done! at ', datetime.now())
         
        if res['code'] == manager_podcast.StatusCode.OK:
            return Response(json.dumps( res['data']), status=200, mimetype='application/json')
        else:
            return Response(json.dumps( {'data': 'unable to add podcast from '+ str(rss_url)} ), status=400, mimetype='application/json')
  

@app.route('/podcast/add', methods=['GET'])
@accept('text/html')
@require_user_id
def web_ui_podcast_add_rss(user_id):
    return render_template("podcast-add-rss.html")


@app.route('/podcast/<int:podcast_id>', methods=['POST'])
@accept('application/json')
@require_user_id
def get_podcast(user_id, podcast_id):
    podcast = manager_podcast.podcast(user_id, podcast_id)
    return Response(json.dumps(podcast), status=200, mimetype='application/json')


@app.route('/podcast/<int:podcast_id>', methods=['GET'])
@accept('text/html')
@require_user_id
def web_ui_podcast(user_id, podcast_id):
    podcast = manager_podcast.podcast(user_id=user_id, podcast_id=podcast_id)
    return render_template("podcast-id.html", podcast=podcast)


@app.route('/podcast/remove/<int:id_podcast>', methods=['POST'])
@require_user_id
def post_remove_podcast(user_id, id_podcast):
    return Response(json.dumps(manager_podcast.remove_podcast(user_id, id_podcast)), status=200, mimetype='application/json')


@app.route('/mini/<int:podcast_id>', methods=['GET'])
@accept('text/html')
@require_user_id
def get_mini(user_id, podcast_id):
    podcast = manager_podcast.podcast(user_id, podcast_id)
    return render_template("mini-pod.html", podcast=podcast)
    

@app.route('/micro/<int:podcast_id>', methods=['GET'])
@accept('text/html')
@require_user_id
def get_micro(user_id, podcast_id):
    podcast = manager_podcast.podcast(user_id, podcast_id)
    return render_template("micro-pod.html", podcast=podcast)


@app.route('/episode/readed', methods=['POST'])
@require_user_id
def post_readed_episode(user_id):
    ids = request.values.get("ids")

    print ("----ids for readed", str(ids))

    return Response(json.dumps(manager_podcast.readed_episodes(user_id, ids)), status=200, mimetype='application/json')


@app.route('/episode/not_readed', methods=['POST'])
@require_user_id
def post_not_readed_episode(user_id):
    ids = request.values.get("ids")
        
    print ("----ids for not_readed", str(ids))

    return Response(json.dumps(manager_podcast.not_readed_episodes(user_id, ids)), status=200, mimetype='application/json')


@app.route('/episode/sync_watch', methods=['POST'])
@require_user_id
def post_sync_watch_episode(user_id):
    ids = request.values.get("ids")

    print ("----ids for sync_watch", str(ids))

    return Response(json.dumps(manager_podcast.sync_watch_episodes(user_id, ids)), status=200, mimetype='application/json')


@app.route('/episode/not_sync_watch', methods=['POST'])
@require_user_id
def post_not_sync_watch_episode(user_id):
    ids = request.values.get("ids")
    print ("----ids for not_sync_watch", str(ids))

    return Response(json.dumps(manager_podcast.not_sync_watch_episodes(user_id, ids)), status=200, mimetype='application/json')


@app.route('/watch/sync', methods=['GET'])
@accept('application/json')
@require_user_id
def get_list_episode_sync_watch(user_id):
    remove_readed = request.values.get("remove_readed")
    if config.ACTIVE_LOG:
        print("user          : "+str(user_id))
        print("remove_readed : "+str(remove_readed))
    return Response(json.dumps(manager_podcast.list_episode_sync_watch(user_id, remove_readed)), status=200, mimetype='application/json')


@app.route('/create_user', methods=['POST'])
@accept('application/json')
def create_user():
    login = request.values.get('login')
    password = request.values.get('password')
    pseudo = request.values.get('pseudo')
    result = manager_podcast.create_account(login, password, pseudo)
    if result.code == manager_podcast.StatusCode.ERROR:
        return Response(json.dumps({'error': result.data}), status=403, mimetype='application/json')
    else:
        session['session_token'] = result.data
        return Response(json.dumps({"token": result.data}), status=200, mimetype='application/json')


@app.route('/create_user', methods=['GET'])
@accept('text/html')
def web_ui_create_user():
    return render_template("create_user.html")


@app.route('/login', methods=['GET'])
@accept('text/html')
def web_ui_login():
    return render_template("login.html")

@app.route('/error', methods=['GET'])
@accept('text/html')
def web_ui_error():
    return render_template("error.html", code = request.values.get('code'), data= request.values.get('data'))


@app.route('/logout', methods=['GET'])
@accept('text/html')
def web_ui_logout():
    session.clear()
    return render_template("login.html")

@app.route('/connect', methods=['POST'])
@accept('application/json')
def connect():
    login    = request.values.get('login')
    password = request.values.get('password')
    response = manager_podcast.token(login, password)
    if config.ACTIVE_LOG :
        print(' ***** connect'+ str( response.data))


    if response.code == manager_podcast.StatusCode.OK:
        session['session_token'] = response.data
        return Response(json.dumps({"token": response.data}), status=200, mimetype='application/json')
    else:
        return Response(json.dumps({"error": response.data}), status=403, mimetype='application/json')

@app.route('/', methods=['GET'])
@accept('text/html')
@require_user_id
def web_ui_home(user_id):
    podcasts = manager_podcast.list_podcast(user_id=user_id, no_episodes=True)
    return render_template("home.html", podcasts = podcasts, user = session['user'],  
                            dbg = config.ACTIVE_LOG,  title = ' Home')


@app.route('/check_this_podcast/<int:podcast_id>', methods=['POST'])
def post_check_this_podcast(podcast_id):
    htmlUrl = request.values.get('html')
    
    resp = manager_podcast.check_this_pod(podcast_id)
    if resp:
        return Response(json.dumps({"code":  manager_podcast.StatusCode.OK,"data":True,"ok":True}), status=200, mimetype='application/json')
    else:
        return Response(json.dumps({"code":  manager_podcast.StatusCode.ERROR,"data": 'Database error',"ok":False}), status=404, mimetype='application/json')


@app.route('/check_new_episodes', methods=['POST'])
@require_user_id
def check_new_episodes(user_id):
    manager_podcast.check_new_episodes(0)
    return Response(json.dumps({}), status=200, mimetype='application/json')


@app.route('/episodes/count', methods=['POST'])
@accept('application/json')
@require_user_id
def post_countEpisodes(user_id):
    res = manager_podcast.countEpisods(user_id, False)
    if res.code == manager_podcast.StatusCode.OK:
        return Response(json.dumps(res.data), status=200, mimetype='application/json')
    else:
        return Response(json.dumps(res.data), status=400, mimetype='application/json')


if __name__ == '__main__':
    port = os.getenv('PORT', '5000')
    app.run(debug=config.ACTIVE_LOG, use_reloader=True, host='0.0.0.0', port=port)
