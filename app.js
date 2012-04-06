function log(s) {
    //console.log(s);
}


function onYouTubePlayerAPIReady() {
    log('player api is ready');
    tweetCollectionView.playFirst();
}


$(function(){
    
    var Tweet = Backbone.Model.extend({

        get_youtube_id: function() {
            var urls = this.get('entities').urls;
            if (urls.length > 0) {
                url = urls[0].expanded_url;
                log(url);
                m = url.match(/\?v\=(.*)&+?/);  // http://www.youtube.com/watch?v=W-RfzP_aTP8&feature=youtube_gdata_player
                if (!m) {
                    m = url.match(/youtu.be\/(.*)/);  // http://youtu.be/_xAgWNjuRik
                }
                log(m);
                if (m) {
                    return m[1];
                }
            }
        }
    });
    
    var TweetView = Backbone.View.extend({

        tagName: 'div',
        className: 'tweet',
        template : _.template($("#tweet-template").html()),

        render : function() {
            this.el.innerHTML = this.template(this.model.toJSON());
            return this;
        },

        play: function() {
            id = this.model.get_youtube_id();
            log(id);
            if (id) {
                playerView.play(id);
            } else {
                tweetCollectionView.playNext();
            }
        }
    });
    
    var Tweets = Backbone.Collection.extend({
        model: Tweet
    });
    
    var TweetCollectionView = Backbone.View.extend({

        initialize: function() {
            var that = this;
            this._tweetViews = [];
            this.currentTrack = 0;
         
            this.collection.each(function(tweet) {
                that._tweetViews.push(new TweetView({model : tweet}));
            });
        },
     
        render: function() {
            var that = this;
            // Clear out this element.
            $(this.el).empty();
       
            // Render each sub-view and append it to the parent view's element.
            _(this._tweetViews).each(function(tv) {
                $(that.el).append(tv.render().el);
            });
        },
  
        playFirst: function() {
            this._tweetViews[0].play();
        },
  
        playNext: function() {
            if (this.currentTrack < this._tweetViews.length - 1) {
                this.currentTrack++;
                this._tweetViews[this.currentTrack].play();
            }
        }
    });
    
    var PlayerView = Backbone.View.extend({

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
                events: {
                  'onReady': this.onPlayerReady,
                  'onStateChange': this.onPlayerStateChange
                }
            });
        },

        onPlayerReady: function(event) {
            log('player is ready');
            event.target.playVideo();
        },

        onPlayerStateChange: function(event) {
            log('player state has changed: ' + event.data);
            if (event.data == YT.PlayerState.ENDED) {
                tweetCollectionView.playNext();
            }
        },
    });
    
    
    $.ajax({
        type: "GET",
        dataType: "JSONP",
        url: "http://search.twitter.com/search.json",
        data: {q: '%23cazhareketi', include_entities: 1},

        success: function(data){
            var tweets = new Tweets(data.results);
            window.tweetCollectionView = new TweetCollectionView({
                collection: tweets,
                el: $(".tweets")[0]
            });
            tweetCollectionView.render();
            window.playerView = new PlayerView({el: $('.video')[0]});
        }
    });
});
