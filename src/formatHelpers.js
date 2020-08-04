export const 

  date2folderName = function(){
    now = new Date();
    year = "" + now.getFullYear();
    month = "" + (now.getMonth() + 1); if (month.length == 1) { month = "0" + month; }
    day = "" + now.getDate(); if (day.length == 1) { day = "0" + day; }
    hour = "" + now.getHours(); if (hour.length == 1) { hour = "0" + hour; }
    minute = "" + now.getMinutes(); if (minute.length == 1) { minute = "0" + minute; }
    second = "" + now.getSeconds(); if (second.length == 1) { second = "0" + second; }

    // return year + month + day + "-" + hour + minute + second;
    return year + "-" + month + "-" + day + "_" + hour + "-" + minute + "-" + second;
  },

  formatFolderName = function(str, sec){
    const mois = ['', 'janv.', 'fév.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'nov.', 'déc.']
    str = str.split('_');
    d = str[0].split('-');
    t = str[1].split('-');
    return d[2] +  ' ' + mois[parseInt(d[1])] +  ' ' + d[0] + ', ' + t[0]+':'+ t[1] + (sec?':'+t[2] : '');
  },

  formatDate = function(timestamp){
    // 2 janv. 2019
    if(timestamp){
      date = new Date(timestamp);
      const mois = ['janv.', 'fév.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'nov.', 'déc.']
      return date.getDate() + ' ' + mois[date.getMonth()] + ' ' + date.getFullYear();
    }
    return '';
  },

  formatDateSpipoll = function(timestamp){
    // yyyy-mm-dd
    if(timestamp){
      date = new Date(timestamp);
      return date.getFullYear() + '-' + (date.getMonth() + 1)  + '-' + date.getDate();
    }
    return '';
  },

  formatTime = function(timestamp){
    // hh:mm
    if(timestamp){
      date = new Date(timestamp);
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
    return '';
  },

  pad2 = function(num){
    return num<10 ? '0'+num : ''+num;
  },
  
  deg2dms = function(deg, latlon) {
    if (isNaN(deg)) return false;

    var card = '';
    if(latlon=='lat'){
      card = deg > 0 ? "N" : "S"
    }
    else {
      card = deg > 0 ? "E" : "W"
    }

    deg=Math.abs(deg);
    var d = Math.floor(deg);
    var minfloat = (deg-d)*60;
    var m = Math.floor(minfloat);
    var secfloat = (minfloat-m)*60;
    var s = Math.round(secfloat * 100) / 100;
    // After rounding, the seconds might become 60. These two
    // if-tests are not necessary if no rounding is done.
    if (s==60) {
      m++;
      s=0;
    }
    if (m==60) {
      d++;
      m=0;
    }
    return "" + d + ":" + m + ":" + s + ":" + card;
  },

  dmsFormat = function(dms){
    if (!dms) return '';

    dms = dms.split(':');
    return "" + dms[0] + "°" +dms[1] + "'" + dms[2] + "''" + dms[3];
  }
;
