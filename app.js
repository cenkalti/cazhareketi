function log(s) {
    //console.log(s);
}


function onYouTubePlayerAPIReady() {
    log('player api is ready');
    window.tweets = new Tweets();
    window.tweetCollectionView = new TweetCollectionView({
        collection: tweets,
        el: $(".tweets")[0]
    });
    tweetCollectionView.render();
}


// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
    var o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
};

parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};


$(function(){
    
    window.Tweet = Backbone.Model.extend({

        getYoutubeId: function() {
            var urls = this.get('entities').urls;
            if (urls.length > 0) {
                url = urls[0].expanded_url;
                log(url);
                p = parseUri(url);
                log(p);
                host = p.host;
                if (host == "youtube.com" || host == "www.youtube.com") {
                    log('youtube.com link');
                    id = p.queryKey.v;
                } else if (host == "youtu.be") {
                    log('youtu.be link');
                    id = p.path.substr(1);
                }
                log('id = ' + id);
                return id;
            }
        },

        isRetweet: function() {
            m = this.get('text').match(/^RT/);
            if (m) {
                log('this is a retweet');
                log(this.get('text'));
                return true;
            } else {
                return false;
            }
        }
    });
    
    window.TweetView = Backbone.View.extend({

        tagName: 'div',
        className: 'tweet',
        template : _.template($("#tweet-template").html()),

        events: {
            "click": "play"
        },

        render : function() {
            this.el.innerHTML = this.template(this.model.toJSON());
            return this;
        },

        play: function() {
            $(this.tagName).removeClass("well");
            this.$el.addClass("well");
            index = tweets.indexOf(this.model);
            log('index = ' + index);
            tweetCollectionView.currentTrackNumber = index;

            id = this.model.getYoutubeId();
            log(id);
            if (id) {
                playerView.play(id);
            } else {
                tweetCollectionView.playNext();
            }
        }
    });
    
    window.Tweets = Backbone.Collection.extend({
        model: Tweet,

        initialize: function () {
            var that = this;
            this._loadTweets();
            setInterval(function(){
                that._loadTweets();
            }, 60000);
        },

        loadSomeMore: function () {
            log('loading some more tweets');
            lastTweet = this.max(function(t){return t.id});
            log('max id: ' + lastTweet.id);
            this._loadTweets(lastTweet.id);
        },

        _loadTweets: function(sinceId) {
            log('loading tweets...');
            var that = this;
            params = {
                q: '%23cazhareketi', 
                include_entities: 1,
                rpp: 30,
                result_type: 'recent'
            };
            if (typeof sinceId !== 'undefined') {
                params.since_id = sinceId;
            }
            $.ajax({
                type: "GET",
                dataType: "JSONP",
                url: "http://search.twitter.com/search.json",
                data: params,

                success: function(data){
                    log("fetched " + data.results.length + ' tweets');
                    sorted = _.sortBy(data.results, function(t){return t.id});
                    sorted.forEach(function(t){
                        log("adding " + t.id);
                        tweet = new Tweet(t);
                        if (!tweet.isRetweet()) {
                            that.add(tweet);
                        }
                    });
                    if (!playerView.isPlaying()) {
                        tweetCollectionView.playNext();
                    }
                }
            });
        },
    });
    
    window.TweetCollectionView = Backbone.View.extend({

        initialize: function() {
            // bind the functions 'add' and 'remove' to the view.
            _(this).bindAll('add', 'remove');

            this.tweetViews = [];
            this.currentTrackNumber = -1;
         
            // add each tweet to the view
            this.collection.each(this.add);
         
            // bind this view to the add and remove events of the collection!
            this.collection.bind('add', this.add);
            this.collection.bind('remove', this.remove);
        },
 
        add : function(tweet) {
          // We create an updating tweet view for each tweet that is added.
          var tv = new TweetView({
            model : tweet
          });
       
          // And add it to the collection so that it's easy to reuse.
          this.tweetViews.push(tv);
       
          // If the view has been rendered, then
          // we immediately append the rendered tweet.
          if (this._rendered) {
            $(this.el).append(tv.render().el);
          }
        },
       
        remove : function(model) {
          var viewToRemove = _(this.tweetViews).select(function(tv) { return tv.model === model; })[0];
          this.tweetViews = _(this.tweetViews).without(viewToRemove);
       
          if (this._rendered) viewToRemove.$el.remove();
        },
     
        render: function() {
            var that = this;

            // We keep track of the rendered state of the view
            this._rendered = true;
         
            this.$el.empty();
         
            // Render each Rweet View and append them.
            _(this.tweetViews).each(function(tv) {
              that.$el.append(tv.render().el);
            });
         
            return this;
        },

        getPlayingTweetView: function () {
            if (this.currentTrackNumber > -1) {
                return this.tweetViews[this.currentTrackNumber];
            }
        },
  
        _playCurrent: function() {
            this.getPlayingTweetView().play();
            this._scrollToCurrentTweet();
        },

        _scrollToCurrentTweet: function() {
            $('html, body').animate({
                scrollTop: this.getPlayingTweetView().$el.offset().top - 460 // 460 is the player height
            }, 500);
        },
  
        playNext: function() {
            // load new tweets if this is the last tweet in this list
            if (this.currentTrackNumber == this.tweetViews.length - 1) {
                tweets.loadSomeMore();
            }
            // do not allow to play the next after the last tweet in the list
            if (this.currentTrackNumber < this.tweetViews.length - 1) {
                this.currentTrackNumber++;
                this._playCurrent();
            }
        },
  
        playPrevious: function() {
            // do not allow to go before the first tweet
            if (this.currentTrackNumber > 0) {
                this.currentTrackNumber--;
                this._playCurrent();
            }
        }
    });
    
    window.PlayerView = Backbone.View.extend({

        player: null,

        events: {
            "click .prev":          "prev",
            "click .next":          "next"
        },

        initialize: function() {
            // This code loads the IFrame Player API code asynchronously.
            var tag = document.createElement('script');
            tag.src = "http://www.youtube.com/player_api";
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        },

        play: function (youtube_id) {
            if (this.player != null) {
                this.player.destroy();
            }
            this.player = new YT.Player('player', {
                height: '264',
                width: '470',
                videoId: youtube_id,
                events: {
                  'onReady': this.onPlayerReady,
                  'onError': this.onPlayerError,
                  'onStateChange': this.onPlayerStateChange
                }
            });
        },

        prev: function () {
            tweetCollectionView.playPrevious();
        },

        next: function () {
            tweetCollectionView.playNext();
        },

        isPlaying: function () {
            return this.player;
        },

        onPlayerReady: function(event) {
            log('player is ready');
            event.target.playVideo();
        },

        onPlayerError: function(event) {
            log('player error: ' + event.data);
            tweetCollectionView.playNext();
        },

        onPlayerStateChange: function(event) {
            log('player state has changed: ' + event.data);
            if (event.data == YT.PlayerState.ENDED) {
                tweetCollectionView.playNext();
            }
        },
    });
    
    window.playerView = new PlayerView({el: $('.video')[0]});
});
