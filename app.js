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


$(function(){
    
    window.Tweet = Backbone.Model.extend({

        getYoutubeId: function() {
            var urls = this.get('entities').urls;
            if (urls.length > 0) {
                url = urls[0].expanded_url;
                log(url);
                m = url.match(/\?v\=(.*)&?/);  // http://www.youtube.com/watch?v=W-RfzP_aTP8&feature=youtube_gdata_player
                if (!m) {
                    m = url.match(/youtu.be\/(.*)/);  // http://youtu.be/_xAgWNjuRik
                }
                log(m);
                if (m) {
                    return m[1];
                }
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

        render : function() {
            this.el.innerHTML = this.template(this.model.toJSON());
            return this;
        },

        play: function() {
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
            this._loadTweets();
        },

        loadSomeMore: function () {
            log('loading some more tweets');
            lastTweet = this.max(function(t){return t.id});
            log('max id: ' + lastTweet.id);
            this._loadTweets(lastTweet.id);
        },

        _loadTweets: function(sinceId) {
            log('loading tweets');
            var that = this;
            params = {
                q: '%23cazhareketi', 
                include_entities: 1,
                rpp: 30,
                result_type: 'recent'
            };
            if (typeof sinceId !== 'undefined') {
                params.since_id = sinceId;
            } else {
                //params.until = '2012-04-02';
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
                    tweetCollectionView.playNext();
                }
            });
        },
    });
    
    window.TweetCollectionView = Backbone.View.extend({

        initialize: function() {
            // bind the functions 'add' and 'remove' to the view.
            _(this).bindAll('add', 'remove');

            this._tweetViews = [];
            this.currentTrack = 0;
         
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
          this._tweetViews.push(tv);
       
          // If the view has been rendered, then
          // we immediately append the rendered tweet.
          if (this._rendered) {
            $(this.el).append(tv.render().el);
          }
        },
       
        remove : function(model) {
          var viewToRemove = _(this._tweetViews).select(function(tv) { return tv.model === model; })[0];
          this._tweetViews = _(this._tweetViews).without(viewToRemove);
       
          if (this._rendered) viewToRemove.$el.remove();
        },
     
        render: function() {
            var that = this;

            // We keep track of the rendered state of the view
            this._rendered = true;
         
            this.$el.empty();
         
            // Render each Rweet View and append them.
            _(this._tweetViews).each(function(tv) {
              that.$el.append(tv.render().el);
            });
         
            return this;
        },
  
        _playCurrent: function() {
            var currentTweetView = this._tweetViews[this.currentTrack];
            currentTweetView.$el.addClass("well");
            currentTweetView.play();
        },
  
        playNext: function() {
            if (this._tweetViews.length == 0) return;
            if (this.currentTrack < this._tweetViews.length - 1) {
                this._tweetViews[this.currentTrack].$el.removeClass("well");
                this.currentTrack++;
                this._playCurrent();
            } else {
                tweets.loadSomeMore();
            }
        },
  
        playPrevious: function() {
            if (this.currentTrack > 0) {
                this._tweetViews[this.currentTrack].$el.removeClass("well");
                this.currentTrack--;
                this._playCurrent();
            }
        }
    });
    
    window.PlayerView = Backbone.View.extend({

        player: null,

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
                //playerVars: {origin: "http://pil.li"},
                events: {
                  'onReady': this.onPlayerReady,
                  'onError': this.onPlayerError,
                  'onStateChange': this.onPlayerStateChange
                }
            });
        },

        onPlayerReady: function(event) {
            log('player is ready');
            event.target.playVideo();
        },

        onPlayerError: function(event) {
            log('player error');
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
