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
    tweets.startFetching();
}


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
                } else {
                    id = null;
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
        template: _.template($("#tweet-template").html()),

        events: {
            "click": "play"
        },

        initialize: function() {
            this.isPlaying = false;
        },

        render: function() {
            this.el.innerHTML = this.template(this.model.toJSON());
            return this;
        },

        _validate: function () {
            return true;
        },

        play: function() {
            $(this.tagName).removeClass("well");
            this.$el.addClass("well");
            index = tweets.indexOf(this.model);
            log('index = ' + index);

            id = this.model.getYoutubeId();
            log(id);

            tweetCollectionView.tweetViews.each(function(view){
                view.isPlaying = false;
            });
            this.isPlaying = true;

            if (id) {
                log('id is ok. playing with player...');
                playerView.play(id);
                tweetCollectionView.scrollToTweetView(this);
            } else {
                log('id is not ok. trying next view...');
                tweetCollectionView.playNext();
            }
        },

        getNextView: function () {
            log('getNextView');
            var i = tweetCollectionView.tweetViews.indexOf(this);
            log('current index = ' + i);
            return tweetCollectionView.tweetViews.at(++i);
        },

        getPreviousView: function () {
            log('getPreviousView');
            var i = tweetCollectionView.tweetViews.indexOf(this);
            log('current index = ' + i);
            return tweetCollectionView.tweetViews.at(--i);
        }
    });
    
    window.Tweets = Backbone.Collection.extend({
        model: Tweet,

        initialize: function () {
            this.isFirstFetch = true;
        },

        comparator: function (t) {
            log('in comparator. id= ' + t.id);
            var rank = t.get("id");
            return rank;
        },

        startFetching: function () {
            var that = this;
            this._loadTweets();
            setInterval(function(){
                that._loadTweets();
            }, 60000);
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
                    data.results.forEach(function(t){
                        log("adding " + t.id);
                        current_model = that.get(t.id);

                        if (!current_model) {
                            var tweet = new Tweet(t);

                            if (!tweet.isRetweet()) {
                                that.add(tweet);
                            }
                        }
                    });

                    if (that.isFirstFetch) {
                        that.isFirstFetch = false;
                        tweetCollectionView.playFirst();
                    } else if (!playerView.isPlaying()) {
                        tweetCollectionView.playNext();
                    }
                }
            });
        },
    });
    
    window.TweetViews = Backbone.Collection.extend({
        model: TweetView,

        comparator: function (tv) {
            log('in comparator. id= ' + tv.model.get('id'));
            var rank = tv.model.get('id');
            return rank;
        }
    });
    
    window.TweetCollectionView = Backbone.View.extend({

        initialize: function() {
            var self = this;
            _(this).bindAll('add_to_list');

            this.tweetViews = new TweetViews();
         
            // add each tweet to the view
            this.collection.each(this.add_to_list);
         
            // bind this view to the add and remove events of the collection!
            this.collection.bind('add', this.add_to_list);

            setInterval(function (argument) {
                self.tweetViews.each(function(tv){
                    tv.render();
                });
            }, 60000);
        },
 
        add_to_list : function(tweet) {
            var index = this.collection.indexOf(tweet);
            var view = new TweetView({model: tweet});
            this.tweetViews.add(view);
            el = view.render().el
            if (index > 0) {
                $(this.$('.tweet')[index - 1]).after(el);
            } else {
                this.$el.prepend(el);
            }
        },
     
        render: function() {
            var that = this;
            this.$el.empty();
            this.collection.each(function (t) {
                that.add_to_list(t);
            });
            return this;
        },

        getPlayingTweetView: function () {
            return tweetCollectionView.tweetViews.find(function(view){
                return view.isPlaying;
            });
        },

        scrollToTweetView: function (tv) {
            log('scrollToTweetView');
            $('html, body').animate({
                scrollTop: tv.$el.offset().top - 460 // 460 is the player height
            }, 500);
        },
  
        playNext: function() {
            current = this.getPlayingTweetView();
            if (current) {
                next = current.getNextView();
                if (next) {
                    next.play();
                }
            }
        },
  
        playPrevious: function() {
            current = this.getPlayingTweetView();
            if (current) {
                previous = current.getPreviousView();
                if (previous) {
                    previous.play();
                }
            }
        },

        playFirst: function () {
            first = this.tweetViews.min(function(tv){return tv.model.get('id')});
            first.play();
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
            if (this.player) {
                return this.player.getPlayerState() != YT.PlayerState.ENDED;
            }
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


function convert_twitter_timestamp (time) {
    date = new Date(Date.parse(time));
    diff = (((new Date()).getTime() - date.getTime()) / 1000);
    day_diff = Math.floor(diff / 86400);

    if (diff < 60)
      return "şimdi"
    else if (diff < 120)
      return "1 dakika önce";
    else if (diff < 3600)
      return Math.floor(diff / 60) + " dakika önce";
    else if (diff < 7200)
      return "1 saat önce";
    else if (diff < 86400)
      return Math.floor(diff / 3600) + " saat önce";
    else if (day_diff == 1)
      return "Dün";
    else if (day_diff <= 7)
      return day_diff + " gün önce";
    else if (day_diff < 31)
      return Math.ceil(day_diff / 7) + " hafta önce";
    else
      return "Uzun zaman önce";
}
