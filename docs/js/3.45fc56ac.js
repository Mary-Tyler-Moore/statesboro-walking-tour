(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([[3],{8041:function(a,n,s){"use strict";var t=s("af78"),e=s.n(t);e.a},"8b24":function(a,n,s){"use strict";s.r(n);var t=function(){var a=this,n=a.$createElement,s=a._self._c||n;return s("q-page",{staticClass:"flex flex-center flip-container"},[s("flipbook",{ref:"flipbook",staticClass:"flipbook",attrs:{pages:a.imageURLs,pagesHiRes:a.highResImageURLs},scopedSlots:a._u([{key:"default",fn:function(n){return[s("div",{staticClass:"action-bar"},[s("left-icon",{staticClass:"btn left",class:{disabled:!n.canFlipLeft},on:{click:n.flipLeft}}),s("plus-icon",{staticClass:"btn plus",class:{disabled:!n.canZoomIn},on:{click:n.zoomIn}}),s("span",{staticClass:"page-num"},[a._v("Page "+a._s(n.page)+" of "+a._s(n.numPages))]),s("minus-icon",{staticClass:"btn minus",class:{disabled:!n.canZoomOut},on:{click:n.zoomOut}}),s("right-icon",{staticClass:"btn right",class:{disabled:!n.canFlipRight},on:{click:n.flipRight}})],1)]}}])})],1)},e=[],i=s("8330"),c=s("71f6"),o=s("ef7a"),l=s("cd27"),f=s("55fe"),p={name:"PageIndex",components:{Flipbook:i["a"],LeftIcon:c["a"],RightIcon:o["a"],PlusIcon:l["a"],MinusIcon:f["a"]},mounted:function(){var a;console.log(this),a=this.$refs.flipbook,a&&window.addEventListener("keydown",(function(n){37===n.keyCode&&a.canFlipLeft&&a.flipLeft(),39===n.keyCode&&a.canFlipRight&&a.flipRight()}))},data:function(){for(var a="../statics/images/",n=[null],s=[null],t=0;t<40;t++)n.push("".concat(a,"/").concat(t+1,".jpg")),s.push("../statics/large-images/".concat(t+1,".jpg"));return{imageURLs:n,highResImageURLs:s}}},u=p,g=(s("8041"),s("2877")),r=s("eebe"),d=s.n(r),b=s("9989"),m=s("09e3"),h=Object(g["a"])(u,t,e,!1,null,null,null);n["default"]=h.exports;d()(h,"components",{QPage:b["a"],QPageContainer:m["a"]})},af78:function(a,n,s){}}]);