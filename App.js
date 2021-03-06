/*

TODO:

. www communication
. gallery
  . folders
  . current session 
  . current session per device
. Devices tabs + prview all
. Distant motion
. real video stream
*/

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View, Image,
  ScrollView,
  Button,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  NativeModules,  
  StatusBar,
  BackHandler,
  Modal,
  SectionList,

  Animated,
} from 'react-native';

import AsyncStorage from '@react-native-community/async-storage';
import Slider from '@react-native-community/slider';
import SplashScreen from "rn-splash-screen";
import KeepScreenOn from 'react-native-keep-screen-on';
import RNFetchBlob from 'rn-fetch-blob';
import ViewShot from "react-native-view-shot";
import BluetoothCP  from "react-native-bluetooth-cross-platform"
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// import RNExitApp from 'react-native-kill-app';
import FastImage from 'react-native-fast-image'

import { colors } from "./src/colors"
import { date2folderName, formatBytes } from './src/formatHelpers.js';
import Cam from "./src/cam"
import {ActionButtons, MotionSetupButtons } from "./src/cam"

import firebaseauth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';


// import * as firebase from 'firebase';
// import '@firebase/auth';
// import '@firebase/firestore';

const previewHeight = 264;
const previewWidth = 200;

const shareState = {
    user:false,
    distantCam:false,
    distantMask:false,
      distantRec:false,
      distantTakingPhoto:false,
      distantSnaping:false,
    distantBattery:false,
    distantStorages:[],
    distantStorage:false,
      previewing:false,
    previewDimensions:false,
    previewRotation:0,
    previewScale:1,
    distantPreviewQuality:0.5,
    distantPreview0:false,
    distantPreview1:false,
    distantPreviewCurrent:0,
};

//-----------------------------------------------------------------------------------------
export default class App extends Component<Props> {
//-----------------------------------------------------------------------------------------
  constructor(props) {
    super(props);
    this.state = {

      devices: [ // for cams handeling.
        { // [0] is local device.
          user:{id:'local', name:'local', connected:true},
          distantBattery:{charging:false, level:0},
          distantStorages:[],
          distantStorage:false,
          distantMask:false,
          distantCam:false,
          previewing:false,
          previewDimensions:false,
          previewRotation:0,
          previewScale:1,
          distantPreviewQuality:0.5,
          distantPreview0:false,
          distantPreview1:false,
          distantPreviewCurrent:0,

          distantRec:false,
          distantTakingPhoto:false,
          distantSnaping:false,
        }
      ],

      storedUsers:[],// array of 
        //  {
        //    id:, 
        //    name:, 
        //    connected:, 
        //    nickname:, 
        //    trusted: //-1=banned, 0=nothing, 1=trusted 
        //  }

      imgLocal: false,
      imgLocalW:0,
      imgLocalH:0,

      modalStorages:false,
      modalDevices:false,
      startup:{
        browseOnStart:false,
        advertiseOnStart:false,
        connectTrustedOnStart:false,
      },
      // browsing:false,
      // advertising:false,

      networkIconAnimValue: new Animated.Value(0),
    };

    this.stopRecordRequested = false;

    this.appWidth = 0;

    this.browsing = false;
    this.advertising = false;
    this.networkAnimationCanRun = true;
    this.networkAnimationTimer = null;

    this.bluetothId = null;
    this.firebaseId = null;
    this.deviceName = null;
    this.listeners=null;
  }

  networkAnimation() {
    const toValue = (this.state.networkIconAnimValue._value==0) ? 15 : 0;
    if(!this.networkAnimationCanRun && toValue==15){
      this.networkAnimationCanRun = true;
      return;
    }
    if(toValue==0){
      Animated.timing(
        this.state.networkIconAnimValue,
        {
          toValue: toValue,
          useNativeDriver: false,
          duration:1000,
        }
      ).start(() => this.networkAnimation())  
    }
    else{
      Animated.timing(
        this.state.networkIconAnimValue,
        {
          toValue: toValue,
          useNativeDriver: false,
          duration:0,
        }
      ).start(() => this.networkAnimation())  
    }
  }


  getDeviceIndex(userId){
    let rv = false;
    this.state.devices.forEach(function(item, index){
      if(item.user.id==userId){
        rv = index;
      }
    });
    return rv;
  }
  getDevice(userId){
    if (false === this.getDeviceIndex(userId)){
      return false;
    }
    else {
      return this.state.devices[this.getDeviceIndex(userId)];
    }
  }

  // TODO: re-think permissions.
  requestForPermission = async () => {
    try{
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,

        PermissionsAndroid.PERMISSIONS.BLUETOOTH, // permission is null
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      ])
      if (granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
      &&  granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
      ){
        // alert('PERMiSSION OK');
      }
      else {
        // alert('NO EPRMiSSION');
        // Exit app.
      }
    } catch (err) {
      console.warn(err)
    }
  }


  componentDidMount() {
    // Quick anim to make button obvious.
    this.networkAnimationCanRun = false;
    this.networkAnimation(); 

    StatusBar.setHidden(true);
    SplashScreen.hide();

   PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,

        PermissionsAndroid.PERMISSIONS.BLUETOOTH, // permission is null
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      ]).then((granted) => {
        if (
            granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.BLUETOOTH'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.BLUETOOTH_ADMIN'] === PermissionsAndroid.RESULTS.GRANTED
        ){
           alert('PERMiSSION OK');
        }
        else {
           alert('NO EPRMiSSION');
          // Exit app.
        }



    NativeModules.RNioPan.getDeviceId((deviceId)=>{
      this.bluetothId = deviceId.substr(0,16);
      this.deviceName = deviceId.substr(16);
      this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
          Alert.alert(
            "Quiter l'application ?",
            "",
            [{
              text: 'Annuler',
              // onPress: () => {return false},
            },{
              text: 'Quitter', 
              onPress: () =>{
                //RNExitApp.exitApp()
                BackHandler.exitApp();
              },
            }]
          );
          return true;
      });

      this.listeners = [
        this.listener1 = BluetoothCP.addPeerDetectedListener(this.PeerDetected),
        this.listener2 = BluetoothCP.addPeerLostListener(this.PeerLost),
        this.listener3 = BluetoothCP.addReceivedMessageListener((msg)=>this.receivedMessage(msg,false)),
        this.listener4 = BluetoothCP.addInviteListener(this.gotInvitation),
        this.listener5 = BluetoothCP.addConnectedListener(this.Connected),
      ]



       // AsyncStorage.removeItem('bannedUsers')
       // AsyncStorage.removeItem('trustedUsers')
       // AsyncStorage.removeItem('storedUsers') 
       // return;

      // Get stored devices.
      AsyncStorage.getItem('storedUsers', (err, storedUsers) => {
       
        if (err || storedUsers===null) {
          AsyncStorage.setItem('storedUsers', JSON.stringify([]));
          storedUsers=[];
        }
        else {
          storedUsers = JSON.parse(storedUsers);
        }
        console.log('get storedUsers',storedUsers);

        // Get already present devices 
        // (happend in dev when refreshing app).
        const devices = [...this.state.devices];

        BluetoothCP.getNearbyPeers((users)=>{
          console.log('did mount getNearbyPeers',users);
          users.forEach((user,index)=>{

              if(this.getDeviceIndex(users.id) === false    // device not  already in state
              // && this.bannedUsersIds.indexOf(user.id) < 0
              ){ // device not banned
                devices.push({...shareState,  user:user});
              }

            const storedUser = storedUsers.find(u => u.id === user.id);
            // index = a.findIndex(x => x.prop2 ==="yutu");
            if(storedUser===undefined){ // insert it
              storedUsers.push({id:user.id, name:user.name, nearby:true,}); 
              //devices.push({...shareState,  user:user});; 
            }
            else{ // update with connected info.
              const index = storedUsers.findIndex(u => u.id === user.id);
              storedUsers[index].connected = user.connected;
              storedUsers[index].name = user.name;
              storedUsers[index].nearby = true;
            }
          })

          this.setState({storedUsers:storedUsers, function(){
               console.log('didmount storedUsers:',storedUsers );
          }});
        });
        ///////


        this.setState({storedUsers:storedUsers}, function(){
   
          // Get start-up params.
          AsyncStorage.getItem('startup', (err, startup) => {
            console.log('get startup params',startup);

            if (err || startup===null) {
              startup = this.state.startup;
              AsyncStorage.setItem('startup', JSON.stringify(startup));
            }
            else {
              startup = JSON.parse(startup);
              this.setState({startup:startup}, function(){
                console.log('get startup params state',this.state.startup);

                if(this.state.startup.browseOnStart){
                  this.browse();  // "WIFI", "BT", and "WIFI-BT"
                  this.networkAnimationTimer = setTimeout( ()=>{this.stopBrowsing()}, 30*1000);
                }

                if(this.state.startup.advertiseOnStart){
                  this.advertise();
                  this.networkAnimationTimer = setTimeout( ()=>{this.stopAdvertising()}, 30*1000);
                }

                // Firebase init.
                if(this.state.startup.viaInternet){
                  this.initFireBase();
                }

              });
            }

          }); // Get startUp params.

        });
      });


      this.getAvailableStorages(false);
      this.getBatteryInfo(false);
    }); // get device id

});
  }

  initFireBase(){   
    /*
    https://firebase.google.com/docs/database/security/rules-conditions
    {
      "rules": {
        ".read": "auth != null",
        //".write": "auth != null",
        "$uid": {
            // Allow only authenticated content owners access to their data
            ".read": "auth != null && auth.uid == $uid",
            ".write": "auth != null && auth.uid == $uid",
              
            "ping": {
                  // Allow only authenticated content owners access to their data
                  ".read": "auth != null",// && auth.uid == $uid",
                  ".write": "auth != null"// && auth.uid == $uid"
            },
            "invitations": {
              "$uid":{
                  // Allow only authenticated content owners access to their data
                  ".read": "auth != null && auth.uid == $uid",
                  ".write": "auth != null && auth.uid == $uid"
              }
            },
            "messages": {
              "$uid":{
                  // Allow only authenticated if path exists.
                  ".write": "auth != null && auth.uid == $uid && data.exists()"
              }
            }
        },
      }
    }
    */

    this.firebaseauth = firebaseauth()
    .signInAnonymously()
    .then((sg) => {
      console.log('User signed in anonymously',sg);
      // s9 CWsf5lmVbqaC6SkpRyvLCQbcbqm2
      // s7 eZ9zEOk4oXOWbcGdhatycf4aaan1


      this.firebaseId = sg.user.uid;

// this.bluetothId=this.firebaseId;

      // Add me on firebase.
      database()
      .ref('/' + this.firebaseId)
      .set({ name:this.deviceName, invitations:false, messages:false,ping:false})
      .then(() => {

        // Set own ping.
        database()
        .ref('/' + this.firebaseId + '/ping' )
        .set('yes_' + new Date());

        // Listen to pings.
        database()
        .ref('/' + this.firebaseId + '/ping' )
        .on('value', snapshot => { 

          // this.fbInvitationListner = database()
          // .ref('/' + this.firebaseId + '/ping' )
          // .off();
          if(snapshot.val() && snapshot.val().indexOf('ping_') == 0){
            database()
            .ref('/' + this.firebaseId + '/ping' )
            .set('yes_' + new Date());
          }
        });

        // Listen to invitations.
        database()
        .ref('/' + this.firebaseId + '/invitations' )
        .on('child_added', snapshot => {
          this.gotInvitation({id:snapshot.key, name:snapshot.val()}, true);
        });

        // Listen to peerlost.
        database()
        .ref('/')
        .on('child_removed', snapshot => {
          this.PeerLost({id:snapshot.key, name:snapshot.val().name, connected:false});
        });


      }).catch(function(error) {
        alert('Firebase write own item \n\n' + error.code + '\n' + error.message + '\n\n');
      });

    })
    .catch(error => {
      if (error.code === 'auth/operation-not-allowed') {
        console.log('Enable anonymous in your firebase console.');
      }
      console.error(error);
    });
  }

  closeFireBase(){
    // Stop listening.
    database().ref('/' + this.firebaseId + '/ping' ).off();
    database().ref('/' + this.firebaseId + '/invitations' ).off();
    database().ref('/' + this.firebaseId + '/messages').off();
    database().ref('/').off();
    // Delete me.
    database().ref('/' + this.firebaseId).remove();

    // firebaseauth() // TODO ?
    // .signOut()
    // .then((sg) => {
    //   console.log('User signed out ',sg);
    //   this.firebaseId = null;
    // });
  }

  componentWillUnmount() {
    console.log('componentWillUnmount');

    if(this.state.startup.viaInternet){
      this.closeFireBase();
    }

    this.stopAdvertising();
    this.stopBrowsing();
    if(this.listeners){
      this.listener1.remove()
      this.listener2.remove()
      this.listener3.remove()
      this.listener4.remove()
      this.listener5.remove()
    }

    this.state.devices.forEach(function(item, index){
      if (item.connected && item.user.id != 'local'){
        this.disconnectFromPeer(item);
        console.log('disconnectFromPeer',item );
      }
    });


    console.log('END componentWillUnmount');
  }


  prevBatteryState = {level: 0, charging: false};
  getBatteryInfo(sendMessage){
    NativeModules.RNioPan.getBatteryInfo()
    .then((battery) => {

      if(this.prevBatteryState.level != battery.level
      || this.prevBatteryState.charging != battery.charging){

        this.setState({devices: Object.assign([], this.state.devices, {0: {
          ...this.state.devices[0],
          distantBattery : battery,
        }})}, function(){
            if(sendMessage!==false){
             this.sendMessage('all', 'distantBattery', battery);
            }
        });

      }
      setTimeout(() => { this.getBatteryInfo() }, 60*1000);
    })
  }

  getAvailableStorages(sendmessage){
    NativeModules.RNioPan.getStorages()
    .then((dirs) => {
      if(dirs.length) {
        // console.log('getAvailableStorages', dirs);
        const devices = this.state.devices;
        devices[0].distantStorages = dirs;
        this.sendMessage( 'all', 'distantStorages', dirs);

        if(devices[0].distantStorage === false){
          let maxSpace = 0;
          let maxSpaceId = 0;
          dirs.forEach(function(item, index){
            if (item.free > maxSpace){
              maxSpace = item.free;
              maxSpaceId = index;
            }
          });
          devices[0].distantStorage = maxSpaceId;
        }

        if(sendmessage){
          this.sendMessage( 'all', 'distantStorage', devices[0].distantStorage);
        }

        this.setState({devices:devices}, function(){

          // Create folders if not exists
          devices[0].distantStorages.map((value) => {

            RNFetchBlob.fs.isDir(value.path +'/local')
            .then((isDir) => {
              if(!isDir){
                RNFetchBlob.fs.mkdir(value.path +'/local')
                .then(() => { 
                  // OK // video thumb dir created on the fly.
                })
                .catch((err) => { 
                  Alert.alert(
                    'Erreur',
                    'Le dossier de stockage des photos pour l\'appareil local n\'a pu être créé.\n'
                    + value.path +'/local'
                    //+ err
                  );
                });
              }
            }); // isDir

          });
        });
      }
    }) // RNioPan.getStorages
    .catch((err) => { 
      console.log('getStorages ERROR', err) 
    })
  }

  componentDidUpdate(){

  }

  //------------------------------------------------------------------------
  //------------------------------------------------------------------------
  //            P2P communication
  //------------------------------------------------------------------------

  advertise(){
    if(!this.advertising){ // avoid launching anim more than once.
      this.advertising = true;
      BluetoothCP.advertise('WIFI-BT');
      if(!this.browsing){
        this.networkAnimation();
      }
    }
  }

  browse(){
    if(!this.browsing){
      console.log('browsing');

      this.browsing = true;
      BluetoothCP.browse('WIFI-BT');
      if(!this.advertising){
        this.networkAnimation();
      }

      //FireBase.
      if(this.state.startup.viaInternet){
        // // Get devices already there.
        // console.log('browsing from ' , this.bluetothId + ' ' + this.firebaseId)
        // database()
        // .ref('/')
        // .once('value', devices => {

        //   devices.forEach((device)=>{
    
        //     console.log('firebase device' )
        //     if(device.key!=this.firebaseId && device.val().name){

        //       console.log(this.firebaseId+'pinging ' , device.key)

        //       // Ping to know if realy online.
        //       database()
        //       .ref('/'+device.key + '/ping/' )
        //       .set('ping_'+this.firebaseId)
        //       .then(() => {

        //         // Listen to ping response.
        //         database()
        //         .ref('/'+devices.key + '/ping/' )
        //         .on('value', snapshot => {

        //           if(snapshot && snapshot.val() && snapshot.val().split('_')[0]=='yes'){

        //             database()
        //             .ref('/'+snapshot.key + '/ping/' )
        //             .off('value');

        //             this.PeerDetected({
        //               nearby: true, 
        //               id: device.key, 
        //               name: device.val().name,
        //             });     
        //           }

        //         });// Ping response
        //       }).catch(function(error) {
        //         alert('set ping Firebase LOGIN ERROR \n\n' + error.code + '\n' + error.message + '\n\n');
        //       });  // set ping

        //     } // if not me
        //   }); // foreach devices 

          // Listen for new comming friends.
          database()
          .ref('/')
          .on('child_added', device => {
            // If not me.
            if(device.key!=this.firebaseId && device.val().name){
              console.log(this.deviceName + ' finds', device.key + ' ' + device.val().name );


              // Ping to know if realy online.
              database()
              .ref('/'+device.key + '/ping/' )
              .set('ping_'+this.firebaseId)
              .then(() => {

                // Listen to ping response.
                database()
                .ref('/'+device.key + '/ping/' )
                .on('value', snapshot => {

                  if(snapshot && snapshot.val() && snapshot.val().split('_')[0]=='yes'){

                    database()
                    .ref('/'+snapshot.key + '/ping/' )
                    .off('value');

                    this.PeerDetected({
                      nearby: true, 
                      id: device.key, 
                      name: device.val().name,
                    });     
                  }

                });// Ping response
              }).catch(function(error) {
                alert('set ping Firebase LOGIN ERROR \n\n' + error.code + '\n' + error.message + '\n\n');
              });  // set ping

              // //Ping not needed here.
              // this.PeerDetected({
              //   nearby: true, 
              //   id: snapshot.key, 
              //   name: snapshot.val().name,
              // });     

            } // if not me
          }); // on news child 

        // }).catch(function(error) {
        //   alert('browsing Firebase'+  +'\n\n' + error.code + '\n' + error.message + '\n\n');
        // }); // get already there 
      }
    }
  }

  stopAdvertising(){
    this.advertising = false;
    this.networkAnimationCanRun = false;
    BluetoothCP.stopAdvertising();
  }

  stopBrowsing(){
    this.browsing = false;
    this.networkAnimationCanRun = false;
    BluetoothCP.stopBrowsing();

    database()
    .ref('/')
    .off('child_added');
  }

  disconnectFromPeer(user){
    BluetoothCP.disconnectFromPeer(user.id);

    this.PeerLost({id:user.id, name:user.name, connected:false});
    this.sendMessage( user.id, 'disconnect', Date.now());
  }

  PeerDetected = (user) => {
    alert('peer')
    console.log('PeerDetected',user)
    //{ "connected": false, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}

    const storedUsers = Object.assign([], this.state.storedUsers);
    console.log('storedUsers 0', this.state.storedUsers);
    //[...this.state.storedUsers];

    if(undefined===storedUsers.find(u => u.id === user.id)){
      // insert it
      console.log(' insert it');
      storedUsers.push({id:user.id, name:user.name, nearby:true,}); 
    }
    else{ 
      console.log(' update with connected info');
      // update with connected info.
      const index = storedUsers.findIndex(u => u.id === user.id);
      // storedUsers[index].connected = user.connected; //{...storedUsers[index], ...user}ioio
      // storedUsers[index].name = user.name;
      //storedUsers[index].nearby = true;
      storedUsers[index] = {...storedUsers[index], ...user};

      // Auto connect if trusted 
      if (!storedUsers[index].connected
      && this.state.startup.browseOnStart
      && this.state.startup.connectTrustedOnStart
      && storedUsers[index].trusted == 1){
        this.sendInvitation(user);
      }
    }

    // Stop browsing/advertising if all trusted users are nearby.
    const allhere = storedUsers.findIndex(u => (u.trusted==1 && !u.nearby)) < 0;
    if(allhere){
      // TODO
      // this.stopAdvertising();
      // this.stopBrowsing();
    }

    this.setState({storedUsers:storedUsers});
  }

  PeerLost = (lostUser) => {
    console.log('PeerLost',lostUser);

    if(this.state.startup.viaInternet){
      // If ony connected via firebase delete dedicated messages item.
      database().ref('/' + this.firebaseId + '/messages/' + lostUser.id).remove().then(() => {
        // Ping to know if it is only a deconnection a a real lost.
        database()
        .ref('/' + lostUser.id + '/ping/' )
        .set('ping_' + this.bluetothId)
        .then(() => {

            this.PeerDetected({
              nearby: false,
              connected: false, 
              id: lostUser.id, 
              name: lostUser.name,
            }, true);  

          // Listen to ping response.
          database()
          .ref('/' + lostUser.id + '/ping/' )
          .on('value', snapshot => {

            if(snapshot && snapshot.val() && snapshot.val().split('_')[0]=='yes'){

              database()
              .ref('/'+snapshot.key + '/ping/' )
              .off('value');

              this.PeerDetected({
                nearby: true,
                connected: false, 
                id: lostUser.id, 
                name: lostUser.name,
              }, true);     
            }

          });// Ping response
        }); // set ping
      });
    }

    // Check if it is only a logout or a real lost.
    BluetoothCP.getNearbyPeers((nearbyUsers)=>{
      const devices = this.state.devices,
            i = this.getDeviceIndex(lostUser.id),
            storedUsers = this.state.storedUsers,
            index = storedUsers.findIndex(o => o.id === lostUser.id),
            stillNearby = nearbyUsers.findIndex(o => o.id === lostUser.id) > -1;
      // console.log(nearbyUser)

      if(i!==false) {
        devices.splice(i, 1);
      }

      if(index >-1){
        if(stillNearby){
          console.log('still nearby');
          storedUsers[index].connected = lostUser.connected;
        }
        else {
          console.log('really lost',storedUsers[index].trusted);
          // If trusted or banned, keep it in list.
          if(storedUsers[index].trusted==1 || storedUsers[index].trusted==-1){
            delete storedUsers[index].nearby;

            // if trusted research it.
            if(storedUsers[index].trusted==1){
              if(this.state.startup.advertiseOnStart) {
                this.advertise();
              }
              if(this.state.startup.browseOnStart) {
                this.browse();
              }
            }
          }
          else{
            storedUsers.splice(index, 1);
          }
        }
      }

      this.setState({
        devices:devices,
        storedUsers:storedUsers,
      }, function(){
        if(this.state.startup.browseOnStart){
          this.browse();  // "WIFI", "BT", and "WIFI-BT"
          this.networkAnimationTimer = setTimeout( ()=>{this.stopBrowsing()}, 30*1000);
        }

        if(this.state.startup.advertiseOnStart){
          this.advertise();
          this.networkAnimationTimer = setTimeout( ()=>{this.stopAdvertising()}, 30*1000);
        }
      })
    });
  }

  getNearbyPeers(callback){

  }

  Connected = (user, firebase=false) => {
    console.log('Connected',user)

    // { "connected": true, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}

    const devices = [...this.state.devices],
          storedUsers = [...this.state.storedUsers]
          ;

    // console.log('storedUsers',storedUsers)

    // Check if not already present in list
    if(this.getDeviceIndex(user.id)===false){
      devices.push({...shareState, user:user});
    }

    const index = storedUsers.findIndex(o => o.id === user.id);
    console.log('index',index)
    if(index >-1 ){
      storedUsers[index].connected = true;//user.connected;
    }

    this.setState({ devices:devices ,storedUsers:storedUsers}, function(){
      // Tell  about me.
      
      // wait for db folder to be created.
      this.sendMessage( user.id, 'fullShareSate', devices[0]);
    });

    // Create folder for that device on each available storage.
    this.getDevice('local').distantStorages.map((value) => {
      RNFetchBlob.fs.isDir(value.path + '/' + user.name.replace(/ /g, "-"))
      .then((isDir) => {
        if(!isDir){

          RNFetchBlob.fs.mkdir(value.path + '/' + user.name.replace(/ /g, "-"))
          .then(() => { 
            // OK .
          })
          .catch((err) => { 
            Alert.alert(
              'Erreur',
              'Le dossier de stockage des photos pour l\'appareil distant n\'a pu être créé.\n'
              + value.path + '/' + user.name.replace(/ /g, "-")
              //+ err
            );
          })
        }
      })
    });

  }


  gotInvitation = (user, firebase=false) => {
    console.log('gotInvitation',user);

    const stored = this.state.storedUsers.find(o => o.id === user.id);

    if(stored && stored.trusted == 1  && this.state.startup.connectTrustedOnStart){
      // Trusted

      // Create db message item for it.
      if(firebase){//this.state.startup.viaInternet
        database().ref('/' + this.firebaseId + '/messages/' + user.id).set('false').then(() => {

          // Listen to messages.
          database()
          .ref('/' + this.firebaseId + '/messages')
          .on('child_changed', snapshot => { 
            // console.log('Firebase message from ' + snapshot.key, snapshot.val() );
            this.receivedMessage({
              id: snapshot.key,
              message:snapshot.val(),
            }, true);
          });

          // Send accepted invitation.
          database()
          .ref('/' + this.firebaseId + '/invitations/' + user.id)
          .set('accepted').then(() => {
            alert('accepted set');
            this.Connected({id:user.id, name:user.name, connected:true}, true);
          });

        }); // create db item.
        
      }
      else{
        BluetoothCP.acceptInvitation(user.id);
      }
    }

    else if(stored && stored.trusted == -1){
      // Banned.
      if(firebase){
        database().ref('/' + this.firebaseId + '/invitations/' + user.id).set('refused');
      }
    }

    else { 
      // Ask human user.
      Alert.alert(
        user.name,
        'id: '+ user.id +'\n' + this._t('gotInvitation_msg'),
        [
          {
            text: this._t('connect'),
            onPress: () => {
              // Create db message item for it.
              if(firebase){//this.state.startup.viaInternet
                database().ref('/' + this.firebaseId + '/messages/' + user.id).set('false').then(() => {

                  // Listen to messages.
                  database()
                  .ref('/' + this.firebaseId + '/messages')
                  .on('child_changed', snapshot => { 
                    // console.log('Firebase message from ' + snapshot.key, snapshot.val() );
                    this.receivedMessage({
                      id: snapshot.key,
                      message:snapshot.val(),
                    }, true);
                  });

                  // Send accepted invitation.
                  database()
                  .ref('/' + this.firebaseId + '/invitations/' + user.id)
                  .set('accepted').then(() => {
                    this.Connected({id:user.id, name:user.name, connected:true}, true);
                  });

                }); // create db item.
              }
              else{
                BluetoothCP.acceptInvitation(user.id);
              }
            }
          },
          // {
          //   text: this._t('connectAndAddToFavorites'), 
          //   onPress: () => {
          //     this.storeUserStatus(user,1);
          //     BluetoothCP.acceptInvitation(user.id)
          //   }
          // },
          {
            text: this._t('refuse'), 
            style: "cancel",
            onPress: () => {
              if(firebase){
                database().ref('/' + this.firebaseId + '/invitations/' + user.id).set('refused');
              }
            }
            
          },
          {
            text: this._t('refuseAndBan'), 
            onPress: () => { 
              if(firebase){
                database().ref('/' + this.firebaseId + '/invitations/' + user.id).set('refused');
              }
              this.storeUserStatus(user,-1);
            }
          },
        ],
      );
    }
  }

  sendInvitation(user){
    console.log(this.bluetothId +' - '+ this.firebaseId + ' sends invitation to', user.id);

    if(user.id.length == 28){
      database()
      .ref('/' + user.id + '/invitations/' + this.firebaseId )
      .set(this.deviceName)
      .then(() => {
                // Set message item for it.
                database().ref('/' + this.firebaseId + '/messages/' + user.id).set('false').then(() => {

                  // Listen to messages.
                  database()
                  .ref('/' + this.firebaseId + '/messages')
                  .off();
                  
                  database()
                  .ref('/' + this.firebaseId + '/messages')
                  .on('child_changed', snapshot => { 
                    console.log('sendInvitation child_changed  ' + snapshot.key, snapshot.val() );
                    this.receivedMessage({
                      id: snapshot.key,
                      message:snapshot.val(),
                    }, true);
                  });

                }); // create db item.

        // Listen for response.
        database()
        .ref('/' + user.id + '/invitations/' + this.firebaseId )
        .on('value', snapshot => {

          if(snapshot.val() != this.deviceName ){
            // Delete invitation
            database().ref('/' + user.id + '/invitations/' + this.firebaseId ).off();
            database().ref('/' + user.id + '/invitations/' + this.firebaseId ).remove();
            if(snapshot.val() == 'accepted'){
              //console.log('invitation response from' + user.id+ ' ' + snapshot.key ,snapshot.val() );


              this.Connected({id:user.id, name:user.name , connected:true}, true);
            }
            else {//if(snapshot.val() == 'refused'){
              Alert.alert(this._t('connectionRejected') + ' ' + user.name + ' '+snapshot.val());
              database().ref('/' + this.firebaseId + '/messages/' + user.id).remove();
            }
          }
        });

      }).catch(function(error) {
        alert('Firebase set invitation '+ '/' + user.id + '/invitations/' + this.firebaseId +'\n\n' + error.code + '\n' + error.message + '\n\n');
      });
    }
    else if(user.id.length == 16){
      BluetoothCP.inviteUser(user.id);
    }
  }


  sendMessage(userId, key, value){
    console.log('sendMessage to ', userId);
    console.log('key',key,);
    // console.log('value', value);

    if(!userId) {
      return;
    }
    else if(userId == 'all'){
      userId=[];
      this.state.devices.forEach(function(device, index){
        if(device.user.id!='local' && device.user.connected){
          userId.push(device.user.id);
        }
      });
    }
    else{
      userId = [userId];
    }


    // Send message to distant device.
    userId.forEach((uid, index)=>{
      console.log('send msg  this.bluetothId', this.bluetothId)
      if(uid.length == 16){
        BluetoothCP.sendMessage(JSON.stringify({key:key , value:value }), uid);
      }
      else if(uid.length == 28){
        database().ref('/' + uid +  '/messages/' + this.firebaseId).set({
          key:key,
          value:value,
        });
      }
    });

  
    const devices = [...this.state.devices];
    if(key=='takeSnap') {
      devices[this.getDeviceIndex(userId)].distantSnaping = true;
      this.setState({devices:devices});
    }
    else if(key=='takePicture') {
      devices[this.getDeviceIndex(userId)].distantTakingPhoto = true;
      this.setState({devices:devices});
    }
  }

  receivedMessage(user, firebase=false) {
    console.log('receivedMessage from ', user.id );
    console.log('firebase' ,firebase);

    if(this.getDeviceIndex(user.id) === false) {
      return false;
    }

    const devices = Object.assign([], this.state.devices),//[...this.state.devices],
          msg = firebase ? user.message : JSON.parse(user.message);

    console.log('key',msg.key);
    // console.log('receivedMessage',msg);
    if(msg.key == 'txt') {
      console.log('value', msg.value);
    }

    //
    // Orders.
    //
    else if(msg.key == 'cmd') {

      if(msg.value=='startRecording'){
        this.refs.cam.videoRequested = user.id;
        this.refs.cam.refs.ActionButtons.stopRecordRequested = false;
        this.refs.cam.takeVideo();
      }
      else if(msg.value=='stopRecording'){
        this.refs.cam.refs.ActionButtons.stopRecordRequested = true;
        this.refs.cam.camera.stopRecording();
      }
    }

    if(msg.key=='getStorages'){
      this.getAvailableStorages();
    }

    else if(msg.key=='toggleCam'){
      this.toggleCam();
    }

    else if(msg.key=='toggleMask'){
      this.toggleMask();
    }

    else if(msg.key=='takeSnap' && this.refs.cam && this.refs.cam.refs.viewShotCam){
      //this.refs.viewShot.capture().then(uri => {
      this.refs.cam.refs.viewShotCam.capture().then(uri => {
        this.sendMessage(user.id, 'snap', uri);
      });
    }

    else if(msg.key == 'takeViewShot' && this.refs.cam && this.refs.cam.refs.viewShotCam){
      // this.refs.viewShot.capture().then(uri => {
      this.refs.cam.refs.viewShotCam.capture().then(uri => {
        this.sendMessage(user.id, 'viewShot', uri);
      });
    }

    else if(msg.key=='takePicture' && this.refs.cam){
      this.refs.cam.pictureRequested = user.id;
      this.refs.cam.takePicture();
    }

    else if(msg.key=='disconnect'){
      this.disconnectFromPeer({id:user.id, connected:false});
    }

    else if( msg.key == 'setStorage' ) { 
      this.setStorage('local', msg.value);
    }

    else if( msg.key == 'setPreviewQuality' ) { 
      devices[0].distantPreviewQuality = msg.value;
      this.setState({ devices: devices }, function(){
        this.sendMessage(user.id, 'distantPreviewQuality',  msg.value);
      });
    }

    //
    // Received data.
    //
    else if( msg.key == 'distantCam'  || msg.key == 'distantRec' 
         ||  msg.key == 'distantMask' || msg.key == 'distantBattery'
         ||  msg.key == 'distantStorages' ||  msg.key == 'distantStorage') { 

      // Preview automatically as soon as cam is on.
      if( msg.key == 'distantCam'){
        devices[this.getDeviceIndex(user.id)].previewing = true;
      }

      devices[this.getDeviceIndex(user.id)][msg.key] = msg.value;
      this.setState({devices:devices}, function(){
        // Preview automatically as soon as cam is on.
        if( msg.key == 'distantCam'){

          this.sendMessage(user.id, 'takeViewShot', Date.now());
        }
      });
    }

    // else if(msg.key == 'previewDimensions') {
    //   devices[this.getDeviceIndex(user.id)].previewDimensions = {
    //         w: msg.value.split('x')[0] ,
    //         h: msg.value.split('x')[1] ,
    //       };
    //   this.setState({devices:devices});
    // }



    else if( msg.key == 'fullShareSate' ) { 

      msg.value.user = this.getDevice(user.id).user; // avoid storring message.
      devices[this.getDeviceIndex(user.id)] = msg.value

      this.setState({
        devices: devices,
      }, function(){
        // console.log('upd   ',this.state.devices)
      });
    }

    else if(msg.key == 'picture' || msg.key == 'snap') {
      // console.log('--- receive  picture or snap or videothumb')

      // Get the name of the device that sent the photo.
      const deviceName = devices[this.getDeviceIndex(user.id)].user.name;
      
      if(msg.key == 'picture'){
        devices[this.getDeviceIndex(user.id)].distantTakingPhoto = false;
      }
      else {
        devices[this.getDeviceIndex(user.id)].distantSnaping = false;
      }
      
      // Store photo as JPEG in dedicated device folder.
      if(deviceName){
        const fileName = this.getDevice('local').distantStorages[this.getDevice('local').distantStorage].path + '/'+ deviceName + '/'  +date2folderName() + '.jpg';
        NativeModules.RNioPan.base64toJPEG(
          msg.value, 
          fileName
        ).then((result) => {
          // console.log('base64toJPEG', result)
          // Output photo
          // console.log('picure', fileName)
          this.setState({
            imgLocal: 'file://' + fileName,
            imgLocalW:result.width,
            imgLocalH:result.height,

            devices:devices,
          })
        }).catch((err) => { 
          Alert.alert(
            'Erreur',
            'base64toJPEG'
            + value.path +'/local'
            //+ err
          );
        });
      }
    }

    // Preview image.
    else if(msg.key== 'viewShot') { 
      if(devices[this.getDeviceIndex(user.id)].distantPreviewCurrent==0){
        devices[this.getDeviceIndex(user.id)].distantPreview0 = 'data:image/jpeg;base64,'+msg.value;
        devices[this.getDeviceIndex(user.id)].distantPreviewCurrent = 1; 
      }
      else {
        devices[this.getDeviceIndex(user.id)].distantPreview1 = 'data:image/jpeg;base64,'+msg.value
        devices[this.getDeviceIndex(user.id)].distantPreviewCurrent = 0; 
      }
      this.setState({devices:devices});
    }
    else{

    }
  }

  //--------------------------- end P2P communication -------------------------------
  //--------------------------------------------------------------------------------- 


  renderCamButton(device){

    if(!device.user.connected) return null;

    const titleStorage = 
      (device.distantStorages 
      && device.distantStorages[device.distantStorage] 
      && device.distantStorages[device.distantStorage].free)
      ? formatBytes(device.distantStorages[device.distantStorage].free)
      : null;

    return (
      <View style = {{flexDirection:'row', backgroundColor:'white'}}>
        <TouchableOpacity
          style={styles.button}
          onPress={  
            device.user.id == 'local'
            ? () => this.toggleCam()
            : () => this.sendMessage(device.user.id, 'toggleCam', device.distantCam) 
          }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
            name='camera'
            size={30}
            color={device.distantCam ? colors.greenFlash : 'grey'}
            backgroundColor='transparent'
        /></TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress = {
            device.user.id == 'local'
            ? () => this.toggleMask()
            : () => this.sendMessage(device.user.id, 'toggleMask', !device.distantMask)
          }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
             name='sleep' // MASK
             size={20}
             color={ device.distantMask ? colors.greenFlash : 'grey'}
             backgroundColor='transparent'
        /></TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress = { () => this.showStorages(device.user.id) }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
             name='micro-sd'  
             size={20}
             color={ this.state.modalStorages ? colors.greenFlash : 'grey'}
             backgroundColor='transparent'
        >
          {/* TODO warn if batterie low level */}
          { titleStorage}
        </MaterialCommunityIcons>
        </TouchableOpacity>

        { !device.distantCam || device.user.id  == 'local'
        ? null
        : <TouchableOpacity
            style={styles.button}
            underlayColor={colors.greenSuperLight}
            onPress = {() => this.togglePreview(device.user.id)}
          ><MaterialCommunityIcons 
               name='eye-outline'  
               size={20}
               color={ device.previewing ? colors.greenFlash : 'grey'}
               backgroundColor='transparent'
          />
          </TouchableOpacity>
        }
      </View>
    );
  }


  renderImageLocal(){
    // if (this.state.imgLocal.length==0) return null;

    if (!this.state.imgLocal) return null;

    return(
       
      <View 
        style = {styles.captureLocalView}
        >
        <Image  
          style = {[
            styles.captureLocal,
            {
              height:this.state.imgLocalH/20,
              width:this.state.imgLocalW/20,
            }
          ]}
          source={{uri:this.state.imgLocal}}
        />
      </View>
    );
  }

  rotatePreview(device){
    const devices = [...this.state.devices];
    devices[this.getDeviceIndex(device.user.id)].previewRotation 
    = (devices[this.getDeviceIndex(device.user.id)].previewRotation + 90)%360; 

    this.setState({devices:devices});
  }

  renderPreview(device){

    // console.log('renderPreview  --------')
    // console.log('renderPreview ', device...);

    if (!device.user.connected || !device.distantCam || !device.previewing
    || (!device.distantPreview0 && !device.distantPreview1)
    // || !device.previewDimensions
     || !device.previewScale
    )
    return null;

    const w = (device.previewRotation==0||device.previewRotation==180)
              ? Math.round(this.appWidth * device.previewScale)
              : Math.round(this.appWidth * 3 / 4
                            * device.previewScale),
          h = (device.previewRotation==0||device.previewRotation==180)
              ? Math.round(this.appWidth * 4 / 3
                            * device.previewScale)
              : Math.round(this.appWidth*device.previewScale);

    const gap = (device.previewRotation==90)
                ? (w-h)/ 2
                : (device.previewRotation==270)
                  ? -(w-h)/ 2
                  :0;
    // const w = (device.previewRotation==0||device.previewRotation==180)
    //           ? Math.round(this.appWidth * device.previewScale)
    //           : Math.round(this.appWidth * device.previewDimensions.w / device.previewDimensions.h
    //                         * device.previewScale),
    //       h = (device.previewRotation==0||device.previewRotation==180)
    //           ? Math.round(this.appWidth * device.previewDimensions.h / device.previewDimensions.w
    //                         * device.previewScale)
    //           : Math.round(this.appWidth*device.previewScale);

    // const gap = (device.previewRotation==90)
    //             ? (w-h)/ 2
    //             : (device.previewRotation==270)
    //               ? -(w-h)/ 2
    //               :0;


    return(
      <View style={{
          flex:1, alignItems:'center',
          backgroundColor:colors.lightBackGround,
        }}
        >



        <View 
          pointerEvents="none"
          style = {[
            device.previewRotation
              ? { transform: [
                  { rotate: device.previewRotation+"deg"},
                  { translateX: gap},

              ]}
              : null,
            {
              width:w,
              height:h,
              backgroundColor:'grey'
            },
          ]}
          >

          {!device.distantPreview0 
            ? null
            : <FastImage
                style = {[
                  styles.distantPreviewImage, 
                  device.distantPreviewCurrent == 0 
                  ? styles.zIndex0 
                  : styles.zIndex1,
                  {
                    width:w,
                    height:h,
                  },
                ]}
                source={{
                    uri: device.distantPreview0,
                    headers: { Authorization: 'someAuthToken' },
                    priority: FastImage.priority.high ,
                }}
                resizeMode={FastImage.resizeMode.contain}
                // onLoad={e => console.log(e.nativeEvent.width, e.nativeEvent.height)}
                onLoad={e => this.sendMessage(device.user.id, 'takeViewShot', Date.now())}
              />
          }
          {!device.distantPreview1
            ? null
            : <FastImage
                style = {[
                  styles.distantPreviewImage, 
                  device.distantPreviewCurrent == 0 
                  ? styles.zIndex1 
                  : styles.zIndex0,
                  {
                    width:w,
                    height:h,
                  },
                ]}
                source={{
                    uri: device.distantPreview1,
                    headers: { Authorization: 'someAuthToken' },
                    priority: FastImage.priority.high ,
                }}
                resizeMode={FastImage.resizeMode.contain}
                onLoad={e => this.sendMessage(device.user.id, 'takeViewShot', Date.now())}
              />
          }
        </View>
        <View
          style={{
          marginTop:-1*Math.abs(2*gap)
          //   transform: [ { translateY: gap*2},  ]
        }}
        >
        <ActionButtons
          ref="ActionButtons"
          isTakingPicture={device.distantTakingPhoto}
          isRecording={device.distantRec}
          motionDetectionMode={null}
          motionsCount={0}

          takePicture={ device.distantRec
            ? () => this.sendMessage(device.user.id, 'takeSnap', Date.now())
            : () => this.sendMessage(device.user.id, 'takePicture', Date.now())
          }

          takeVideo={() => this.sendMessage(device.user.id, 'cmd', 'startRecording')}
          stopRecording={() => this.sendMessage(device.user.id, 'cmd', 'stopRecording')}

          onMotionButton={()=> {}}
        /> 

        <View
          style={{
            flexDirection:'row',
            alignSelf:'stretch',
            alignItems:'center',
            justifyContent:'center',
            marginRight:10,
            marginLeft:10,
          }}
          >
          <TouchableOpacity
            style={{  alignItems:'center',
              justifyContent:'center',
              height:50, width:50,}} 
            underlayColor={colors.greenSuperLight}
            onPress = {() => this.rotatePreview(device)}
          ><MaterialCommunityIcons 
               name='phone-rotate-landscape'  
               size={30}
               color={colors.greenFlash}
               backgroundColor='transparent'
          />
          </TouchableOpacity>
          <Slider  
            ref="distantPreviewQuality"
            style={{flex:1, height:50}} 
            thumbTintColor = {colors.greenFlash}
            minimumTrackTintColor={colors.greenFlash}
            maximumTrackTintColor={colors.greenFlash} 
            minimumValue={0.1}
            maximumValue={0.95}
            step={0.05}
            value={device.distantPreviewQuality}
            onValueChange={(quality) => this.sendMessage(device.user.id, 'setPreviewQuality', quality)}
          />
          {/*
          <Slider  
            ref="previewScale"
            style={{flex:1, height:50}} 
            thumbTintColor = {colors.greenFlash}
            minimumTrackTintColor={colors.greenFlash}
            maximumTrackTintColor={colors.greenFlash} 
            minimumValue={0.2}
            maximumValue={1}
            step={0.1}
            value={device.previewScale}
            onValueChange={(scale) => this.setPreviewScale(device.user.id,scale)}
          />
        */}
        </View>
        </View>

      </View>
    );
  }

  setPreviewScale(userId,scale){
        const devices = [...this.state.devices],
          deviceIndex = this.getDeviceIndex(userId);

        devices[deviceIndex].previewScale = scale;
        this.setState({devices:devices});
  }

  toggleCam() { // Local cam.
    const cam = !this.state.devices[0].distantCam;
    this.setState({devices:  Object.assign([], this.state.devices, {0: {
          ...this.state.devices[0],
          distantCam : cam,
        }})
    }, function(){
      this.sendMessage('all', 'distantCam', cam);
    });
  }

  togglePreview(userId) { // Distant cam.
    console.log('togglePreview')
    const devices = [...this.state.devices],
          deviceIndex = this.getDeviceIndex(userId);

    devices[deviceIndex].previewing = !devices[deviceIndex].previewing;
    this.setState({devices:devices}, function(){
      if (devices[deviceIndex].previewing){
        this.sendMessage(userId, 'takeViewShot', Date.now());
      }
    });
  }

  toggleMask() {
    const mask = !this.state.devices[0].distantMask;
    if(mask){
      NativeModules.RNioPan.hideNavigationBar();
    } 
    else{
      NativeModules.RNioPan.showNavigationBar();
    }

    this.setState({devices:  Object.assign([], this.state.devices, {0: {
          ...this.state.devices[0],
          distantMask : mask,
        }})
    }, function(){
      this.sendMessage('all', 'distantMask', mask);
    });
  }

  renderCam(){

    // Avoid sender message on each render
    // => done on toggleCam() 
    // if(this.state.devices.length>1){
    //   this.sendMessage('all', 'distantCam', true);
    // }

    return (
      <ViewShot
        key="renderCamera"
        ref="viewShot"

        // onLayout={(event) => this.sendMessage(
        //   // TODO: Tricky if cam is already ready before connection. 
        //   'all',
        //   'previewDimensions',
        //   event.nativeEvent.layout.width+'x'+event.nativeEvent.layout.height
        // )}

        options={{
          format: "jpg", 
          quality: this.state.devices[0].distantPreviewQuality,
          result:"base64",
        }}
      >
      <Cam ref="cam"
        mode='free'
        viewShotQuatity={this.state.devices[0].distantPreviewQuality}

        path = {this.getDevice('local').distantStorages[ this.getDevice('local').distantStorage ].path+'/local'}
        onPictureTaken = {(info) => this.onPictureTaken(info)} // local
        onRequestedPictureTaken = {(userId, base64) => this.sendMessage(userId, 'picture', base64)} //distant
        recording =  {(isRecording) => this.sendMessage('all', 'distantRec', isRecording)}
      
        // onCamLayout={(w,h) => this.sendMessage(
        //   // TODO: Tricky if cam is already ready before connection. 
        //   'all',
        //   'previewDimensions',
        //   w+'x'+h
        // )}
      />
     </ViewShot> 
    );
  }

  onPictureTaken(info){
    // console.log('onPictureTaken',info)
    this.setState({
      imgLocal:info.uri,
      imgLocalW:info.width,
      imgLocalH:info.height,
    })
  }

  setStorage(userId, index){
    const devices = [...this.state.devices];
    devices[this.getDeviceIndex(userId)].distantStorage = index;

    this.setState({devices:devices, modalStorages:false}, function(){

      if(userId != 'local') {
        this.sendMessage(userId, 'setStorage', index);
      }
      else{
        // feedback
        this.sendMessage('all', 'distantStorage', index);
      }
    });
  }

  render() {
    // console.log('RENDER: this.state',this.state);
    return (
      <View 
      style={styles.mainContainer}
      onLayout={(event) => { this.appWidth = event.nativeEvent.layout.width}}
      >

      <ScrollView style={{flex:1, backgroundColor:'grey', paddingBottom:200}}>
        { // Devices.
          this.state.devices.map((value, index) => {
          // console.log('render map value', value);
          return(
            <View 
              key = {value.user.id}
              style={{
                  flex:1,}}
              >
  
              <View 
                style={{
                  flex:1,
                  flexDirection:'row',
                  minHeight:40,
                  // alignItems:'center',
                  justifyContent:'center',
                  backgroundColor:value.user.connected ? colors.greenFlash : 'grey',
                }}
                >

                <TouchableOpacity
                  style={[
                    {                     
                      flex:1,
                      alignItems:'center',
                      justifyContent: 'center',
                      borderRightWidth:1, borderColor:'white',
                    }
                  ]}
                  activeOpacity={ value.user.id=='local' 
                    ? 1
                    : 0.2
                  }
                        // TODO: show detail
                  onPress = { value.user.id=='local' 
                    ? null
                    : value.user.connected
                      ? () => this.disconnectFromPeer(value.user)
                      : () => this.sendInvitation(value.user)
                  }
                  >
                  <Text
                    style={{
                      fontSize:14,
                      fontWeight:'bold',
                      textTransform: 'uppercase', 
                      color:'white',
                    }}
                  >
                    {value.user.name}
                  </Text>
                </TouchableOpacity>
         
                { value.user.id!='local'
                  ? value.user.connected ? this.renderBattery(value.distantBattery) : null
                  : <TouchableOpacity
                      style={[styles.button]}
                      underlayColor={colors.greenSuperLight}
                      onPress = { () =>this.showDevices(true) }
                    >
                    <View style={{position:'relative',width:40,height:40, marginRight:10,  }}>
                      <MaterialCommunityIcons
                        name='access-point' 
                        size={40}
                        color={'white'}
                        backgroundColor = 'transparent'
                        style={{
                          position:'absolute',alignSelf: 'center',
                        }}
                      />
                      <Animated.View style={{
                        position:'absolute',
                        borderRadius:40, 
                        borderWidth: this.state.networkIconAnimValue,
                        borderColor:colors.greenFlash,  
                        opacity:0.6,
                        width:40,
                        height:40}}
                      />
                    </View>  
                  </TouchableOpacity>
                }

              </View>

              { this.renderCamButton(value) }

              { value.user.id=='local' && value.distantCam
                ? this.renderCam() 
                : null
              }

              <View style={styles.containerPreview}>
                { this.renderPreview(value) }
              </View>

            </View>)
          }


        // map devices
        )} 


         <View style={styles.containerPreview}>
          { this.renderImageLocal() }
        </View>
      </ScrollView>

      {this.renderModalStorages()}
      {this.renderModalDevices()}

      {this.state.devices[0].distantMask 
      ? <TouchableOpacity ref="black_mask_to_save_battery"
           activeOpacity={1}
           style={{
            position:'absolute', backgroundColor:'black', top:0,bottom:0,left:0,right:0,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection:'row',
          }}
          onLongPress = {() => this.toggleMask()}
        >

        {/*         
          <Text
            style={{
              color:this.state.battery.charging ? colors.greenFlash : 'grey', 
              fontSize:50,fontWeight:'bold'}}
            >
            {this.state.battery.level}%
          </Text>
          { this.state.battery.charging
            ? <MaterialCommunityIcons 
                backgroundColor={'transparent'} 
                name='battery-charging'
                size={60}
                color={colors.greenFlash}
              />
            : <MaterialCommunityIcons 
                name='battery-40' 
                color={'grey'}
                backgroundColor={'transparent'}
                size={60}
              /> 
          }
        */}
        </TouchableOpacity>
      :null
      }




      </View>
    );
  }

  renderBattery(bat){
    if(!bat || !Number.isInteger(bat.level))
      return null;

    return(
      <View 
        style={{
          paddingLeft:5, paddingRight:10,
          flexDirection:'row',
          alignItems:'center', justifyContent:'center',
        }}
        >
        <Text 
          style={{
            paddingRight:3,
            fontSize:14,
            color: bat.level>15 ? 'white':colors.purple
          }}>
          { bat.level + '%'}
        </Text> 
        <MaterialCommunityIcons 
          name={this.batteryIcon(bat)} 
          color={'grey'}
          backgroundColor={'transparent'}
          size={16}
          style={{color: bat.level>15 ? 'white':colors.purple}}
          >
        </MaterialCommunityIcons>

      </View>
    );
  }
  batteryIcon(bat){
    let name = 'battery';
    if(bat.charging){
      name += '-charging';
    }
    else{
      const levelRound = Math.round(bat.level / 10) * 10;
      if(levelRound == 100){
      }
      else if(levelRound == 0){
        name += '-outline';
      }
      else{
        name += '-'+levelRound;
      }
    }
    return name;
  }

  showStorages(userId) {
    this.sendMessage(userId, 'getStorages', Date.now());
    this.setState({modalStorages:userId});
  }
  renderModalStorages(){
    if(this.state.modalStorages===false) return null;
    
    // console.log('modalStorages',  this.state.modalStorages) ;
    // console.log('getDeviceIndex',  this.getDeviceIndex(this.state.modalStorages))
    // console.log('distantStorages', this.state.devices[this.getDeviceIndex(this.state.modalStorages)].distantStorages)

    const curPath = this.state.modalStorages 
    && this.getDevice(this.state.modalStorages) !== false
    && this.getDevice(this.state.modalStorages).distantStorage !== false
    && this.getDevice(this.state.modalStorages).distantStorages.length >= 0
    && this.getDevice(this.state.modalStorages).distantStorages[ this.getDevice(this.state.modalStorages).distantStorage ].path
      ? this.getDevice(this.state.modalStorages).distantStorages[
          this.getDevice(this.state.modalStorages).distantStorage
        ].path
      : '';

    return(
      <Modal
        style={{marginTop:20}}
        animationType="slide"
        transparent={false}
        visible={this.state.modalStorages!==false}
        onRequestClose={() => this.showStorages(false)}
      >
          <View style={{ flex:1}}></View>
          <View style={{ flex:1}}>
            { this.state.devices[this.getDeviceIndex(this.state.modalStorages)].distantStorages.map((value, index) =>

              <TouchableOpacity 
                key={index}
                style={{
                  padding:5,
                  flexDirection:'row', 
                  flex:1, 
                  justifyContent:'center', 
                  alignItems:'center',
                }}
                onPress = {() => this.setStorage(this.state.modalStorages, index)} 
                >
                <MaterialCommunityIcons
                  name={ value.removable ?  "micro-sd" : "cellphone-android" }
                  style={{flexDirection:'column',
                    backgroundColor:'transparent',
                    color: curPath == value.path ? colors.greenFlash :'grey',
                  }}
                  size={50}
                >
                  <View>
                    <Text style={{fontSize:14,
                      color: curPath == value.path ? colors.greenFlash :'grey',
                      }}>{formatBytes(value.total)}</Text>

                    <Text style={{fontSize:16,
                      color: curPath == value.path ? colors.greenFlash :'grey',
                      }}>
                    {formatBytes(value.free)} {this._t('free')}</Text>
                  </View>
                </MaterialCommunityIcons>
        
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flex:1}}></View>
      </Modal>

    );
  }


  showDevices(visible) {
    clearTimeout(this.networkAnimationTimer);
    if(visible){
      this.advertise();   // "WIFI", "BT", and "WIFI-BT"
      this.browse();

      this.setState({
        //networkAnimation:new Animated.Value(0),
        modalDevices:visible
      });
    }
    else{
      this.stopAdvertising();
      this.stopBrowsing();
      this.setState({modalDevices:visible});
    }
  }

  renderModalDevices(){
    if(this.state.modalDevices===false) 
      return null;

    console.log('renderModalDevices', this.state.storedUsers);

    const DATA = [
      { 
        title : 'safe',
        data : this.state.storedUsers.filter(o => o.trusted == 1),
      },{
        title : 'availabe',
        data : this.state.storedUsers.filter(o => !o.trusted),  
      },{
        title : 'banned',
        data : this.state.storedUsers.filter(o => o.trusted == -1),  
      }
    ];
    return(
      <Modal
        animationType="slide"
        transparent={false}
        visible={this.state.modalDevices!==false}
        onRequestClose={() => this.showDevices(false)}
        >

        <SectionList
          style={{ flex:1}}
          sections={DATA}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }) => this.renderUser(item)}

          ListHeaderComponent={
            <View style={{ paddingLeft:20, paddingRight:20,
            }}>
            <View
              style={{ backgroundColor:colors.lightBackGround,
                  flexDirection:'row',
                  alignItems:'center', justifyContent:'center',
                   paddingTop:40, paddingBottom:30}}
              >
              <Text style={{fontWeight:'normal', fontSize:26, color:'grey',marginRight:10,}}>
                {this._t('distantDevices')}
              </Text>


              <View style={{position:'relative',width:40,height:40, marginRight:10,  }}>
                <MaterialCommunityIcons
                  name='access-point' 
                  size={40}
                  color={'grey'}
                  backgroundColor = 'transparent'
                  style={{ position:'absolute' }}
                />
                <Animated.View style={{
                  position:'absolute',
                  borderRadius:40, 
                  borderWidth: this.state.networkIconAnimValue,
                  borderColor:colors.lightBackGround,  
                  opacity:0.7,
                  width:40,
                  height:40}}
                />
              </View>  

              </View>
              <TouchableOpacity 
                style={{
                  marginBottom:20,
                  flexDirection:'row',
                  alignItems:'center',
                  backgroundColor:'white', 
                  borderColor:'lightgrey', borderWidth:1, padding:1,
                  alignSelf:'stretch',
                  paddingRight:40
                }} 
                onPress={()=>this.setStartUpParam('viaInternet', !this.state.startup.viaInternet)}
                >
                <MaterialCommunityIcons
                  name= {this.state.startup.viaInternet ? "checkbox-marked" : "checkbox-blank-outline"}
                  style={{ 
                    color: colors.greenFlash, margin:5,
                    backgroundColor:'transparent',
                  
                  }}
                  size={25}
                />
                <Text style={{padding:5, fontSize:14, 
                  color:'grey', backgroundColor:'white',}}>
                  {this._t('viaInternet')}
                </Text>
              </TouchableOpacity> 
            </View>      
          }

          renderSectionHeader={({ section: { title } }) => (
            <View
              style={{ flex:1, flexDirection:'row', backgroundColor:colors.greenFlash,
                  alignItems:'center',justifyContent:'center', marginBottom:1, padding:10}}
              >
                <MaterialCommunityIcons
                  name={ title=='safe'
                          ? 'bookmark-plus-outline' 
                          :  title=='banned' ? 'cancel' : 'leak'}
                  style={{
                    flexDirection:'column',
                    backgroundColor:'transparent',
                    color: 'white',
                    marginRight:10,
                  }}
                  size={30}
                />
              <Text style={{textTransform:'uppercase', fontWeight:'bold', fontSize:16, color:'white'}}>
                {this._t(title)}
              </Text>
            </View>
          )}

          renderSectionFooter={({ section: { data } }) => (
            !data.length
            ?  <View style={{alignItems:'center', padding:5,backgroundColor:'transparent', height:50}}><Text style={{color:'grey'}}>({this._t('none')})</Text></View>
            :  <View
              style={{ backgroundColor:'transparent', height:50}}
              ></View>
          )}

          ListFooterComponent={
            <View
              style={{ backgroundColor:colors.lightBackGround,
                  alignItems:'center', justifyContent:'center', paddingTop:40, paddingBottom:20,
                  paddingLeft:20, paddingRight:20,}}
              >
              <Text style={{fontWeight:'normal', fontSize:26, color:'grey', marginBottom:30}}>
                {this._t('startupParameters')}
              </Text>
       
              <TouchableOpacity 
                style={{
                  marginBottom:20,
                  flexDirection:'row',
                  alignItems:'center',
                  backgroundColor:'white', 
                  borderColor:'lightgrey', borderWidth:1, padding:1,
                  alignSelf:'stretch',
                  paddingRight:40
                }} 
                onPress={()=>this.setStartUpParam('browseOnStart', !this.state.startup.browseOnStart)}
                >
                <MaterialCommunityIcons
                  name= {this.state.startup.browseOnStart ? "checkbox-marked" : "checkbox-blank-outline"}
                  style={{ 
                    color: colors.greenFlash, margin:5,
                    backgroundColor:'transparent',
                  
                  }}
                  size={25}
                />
                <Text style={{padding:5, fontSize:14, 
                  color:'grey', backgroundColor:'white',}}>
                  {this._t('browseOnStart')}
                </Text>
              </TouchableOpacity> 

              <TouchableOpacity 
                style={{
                  marginBottom:20,
                  flexDirection:'row',
                  alignItems:'center',
                  backgroundColor:'white', 
                  borderColor:'lightgrey', borderWidth:1, padding:1,
                  alignSelf:'stretch',
                  paddingRight:40
                }}
                onPress={()=>this.setStartUpParam('advertiseOnStart', !this.state.startup.advertiseOnStart)}
                >
                <MaterialCommunityIcons
                  name= {this.state.startup.advertiseOnStart ? "checkbox-marked" : "checkbox-blank-outline"}
                  style={{ 
                    color: colors.greenFlash, margin:5,
                    backgroundColor:'transparent',
                  
                  }}
                  size={25}
                />
                <Text style={{padding:5, fontSize:14, 
                  color:'grey', backgroundColor:'white',}}>
                  {this._t('advertiseOnStart')}
                </Text>
              </TouchableOpacity> 

              { // Warn it is better to have one master & multiple clients.
                this.state.startup.browseOnStart && this.state.startup.advertiseOnStart
                ? <View
                    style={{flexDirection:'row',
                      backgroundColor:'transparent', marginBottom:40,
                    }}>
                  <MaterialCommunityIcons
                    name= "information-outline"
                    style={{ 
                      color: colors.greenFlash,
                      backgroundColor:'transparent',
                    }}
                    size={20}
                  >
                    <Text style={{fontSize:14, color:'grey'}}>
                      {'  ' + this._t('betteronlyone')}
                    </Text>

                  </MaterialCommunityIcons>
                    </View>
                : null
              }

              <TouchableOpacity 
                style={{
                  marginBottom:20,
                  flexDirection:'row',
                  alignItems:'center',
                  backgroundColor:'white', 
                  borderColor:'lightgrey', borderWidth:1, padding:1,
                  alignSelf:'stretch',
                  paddingRight:40
                }}
                onPress={
                  !this.state.startup.browseOnStart && !this.state.startup.advertiseOnStart
                  ? null
                  : ()=>this.setStartUpParam('connectTrustedOnStart', !this.state.startup.connectTrustedOnStart)
                }
                >
                <MaterialCommunityIcons
                  name= {
                    this.state.startup.connectTrustedOnStart 
                    && (this.state.startup.browseOnStart||this.state.startup.advertiseOnStart)
                    ? "checkbox-marked" 
                    : "checkbox-blank-outline"
                  }
                  style={{ 
                    color: !this.state.startup.browseOnStart && !this.state.startup.advertiseOnStart
                      ? 'lightgrey'
                      : colors.greenFlash, 
                    padding:5,
                    backgroundColor:'transparent',
                  }}
                  size={25}
                />
                <Text style={{padding:5, fontSize:14, 
                  color: !this.state.startup.browseOnStart && !this.state.startup.advertiseOnStart
                      ? 'lightgrey'
                      : 'grey', 
                  backgroundColor:'white',}}>
                  {this._t('connectTrustedOnStart')
                }
                </Text>
              </TouchableOpacity> 

            </View>
          }
        // end sectionList
        />
      </Modal>
    );
  }

  setStartUpParam(key, value){
    this.setState({startup:{...this.state.startup, [key]:value}}, function(){
      AsyncStorage.setItem('startup', JSON.stringify(this.state.startup));

      if(key=='viaInternet'){
        if(value){
          this.initFireBase();
        }
        else{
          this.closeFireBase();
        }
      }
    });
  }

  renderUser(user){
    return(
      <View
         
        style={{
          padding:10,
          flexDirection:'row', 
          flex:1, 
          justifyContent:'center', 
          alignItems:'center',
          // backgroundColor:index%2==1 ? colors.greenSuperLight : 'transparent'
        }}>

        <TouchableOpacity 
          style={{
            flexDirection:'row', 
            flex:1, 
          }}
          onPress = { !user.nearby || user.trusted == -1
            ? null
            :  user.connected
              ? () => this.disconnectFromPeer(user)
              : () => this.sendInvitation(user)
          }
          >
          <MaterialCommunityIcons
            name={ user.nearby 
              ? "cellphone-nfc" 
              : "cellphone-nfc-off" 
            }
            style={{
              backgroundColor:'transparent',
              color: (user.connected && user.nearby) ? colors.greenFlash :'grey',
            }}
            size={40}
          />

          <View style={{ flex:1}}>
            { user.nickname
              ? <View><Text
                  style={{
                    color: (user.connected && user.nearby) ? colors.greenFlash :'grey',
                    fontSize: 18,
                  }}
                  >
                  {user.nickname}
                </Text>
                <Text
                  style={{
                    color: (user.connected && user.nearby) ? colors.greenFlash :'grey',
                    fontSize: 14,
                  }}
                  >
                  {user.name}
                </Text></View>
              : <Text
                  style={{
                    color: (user.connected && user.nearby) ? colors.greenFlash :'grey',
                    fontSize: 18,
                  }}
                  >
                  {user.name}
                </Text>
            }
            <Text
              style={{
                color: (user.connected && user.nearby) ? colors.greenFlash :'grey',
                fontSize: 14,
              }}
              >
              {user.id}
            </Text>
          </View>

        </TouchableOpacity>

        { user.nearby 
          ? <TouchableOpacity 
              // activeOpacity={ user.id=='local' 
              //   ? 1
              //   : 0.2
              // }
              // remember button  
              onPress = {() => this.storeUserStatus(user,1)} 
              >
              <MaterialCommunityIcons
                name={ "bookmark-plus-outline" }
                style={{
                  width:50,
                  backgroundColor:'transparent',
                  color: user.trusted == 1 ? colors.greenFlash :'grey',
                }}
                size={40}
              >
              </MaterialCommunityIcons>
            </TouchableOpacity>
          : null
        }

        { user.nearby 
          ? <TouchableOpacity 
              // ban button
              onPress = {() => {
                this.storeUserStatus(user,-1);
                this.disconnectFromPeer(user);
              }}
              >
              <MaterialCommunityIcons
                name={ "cancel" }
                style={{
                  width:50,
                  backgroundColor:'transparent',
                  color: user.trusted == -1 ? colors.greenFlash :'grey',
                }}
                size={40}
              >
              </MaterialCommunityIcons>
            </TouchableOpacity>
          : <TouchableOpacity 
              // forget button
              onPress = {() => this.storeUserStatus(user,0)} 
              >
              <MaterialCommunityIcons
                name={ "trash-can-outline" }
                style={{
                  width:50,
                  backgroundColor:'transparent',
                  color: 'grey',
                }}
                size={40}
              >
              </MaterialCommunityIcons>
            </TouchableOpacity>
        }
      </View>
    )
  }

  storeUserStatus(user, trusted){
    const storedUsers = [...this.state.storedUsers],
          index = storedUsers.findIndex(o => o.id === user.id);

    if(index<0){
      storedUsers.push(user);
      index = storedUsers.length() - 1;
    }

    if(trusted==1){
      storedUsers[index].trusted = storedUsers[index].trusted == 1 ? 0 : 1;
    }
    else if(trusted==-1){
      storedUsers[index].trusted = storedUsers[index].trusted == -1 ? 0 : -1;
    }
    else{ // forget
      storedUsers.splice(index,1);
    }

    this.setState({ storedUsers:storedUsers } , function(){
      const o = JSON.parse(JSON.stringify(storedUsers))
      //if(trusted!=0){
        delete o[index].nearby;
        delete o[index].connected;
      //}
      AsyncStorage.setItem('storedUsers', JSON.stringify(o));
    });
  }


  _t(str){
    const lang = (Platform.OS === 'ios' ? 
                NativeModules.SettingsManager.settings.AppleLocale:
                NativeModules.I18nManager.localeIdentifier).substr(0,2),
    msgs = {
      free:{
        en:'free',
        fr:'libres',
      },
      distantDevices:{
        en:'Distant devices',
        fr:'Appareils distants',
      },

      safe:{
        en:'Safe',
        fr:'Sûres',
      },
      banned:{
        en:'Banned',
        fr:'Bannis',
      },
      availabe:{
        en:'availabe',
        fr:'disponibles',
      },
      none:{
        en:'none',
        fr:'aucun',
      },

      startupParameters:{
        en:'On startup',
        fr:'Au démarrage',
      },
      browseOnStart:{
        en:'Browse for distant devices',
        fr:'Rechercher les appareils distants',// au démarrage de l\'application',
      },
      advertiseOnStart:{
        en:'Advertise this device.',
        fr:'Rendre cet appareil visible',// au démarrage de l\'application',
      },
      connectTrustedOnStart:{
        en:'Connect to trusted devices.',
        fr:'Se connecter aux appareils sûres',
      },
      betteronlyone:{
        en:'It is better to select only one of the two above options, '
          +'so the device knows if it must behave as a server or as a client.\n\n'
          +'For optimal performances, your need to setup only one device as a server (the one that browses) '
          +'and one or more clients (that advertise themself).',
        fr:'Il est préférable de ne sélectionner  qu\'une seule des deux options ci-dessus '
          +'afin que l\'appareil puisse déterminer s\'il doit se comporter en tant que serveur ou en tant client.\n\n'
          +'Pour une performance optimale, vous devez n\'avoir qu\'un seul serveur (l\'appareil qui effectue la recherche) '
          +'et un ou plusieurs clients (les appareils qui se rendent visibles).'
      },
      viaInternet:{
        en:'Connect via internet',
        fr:'Connection via internet',
      },
      gotInvitation:{
        en:'Connection request',
        fr:'Demande de connection',
      },
      gotInvitation_msg:{
        en:'\nwants to connect.',
        fr:'\ndemande à se connecter.',
      },
      connect:{
        en:'Connect',
        fr:'Connecter',
      },
      connectAndAddToFavorites:{
        en:'Connect and add to favorites',
        fr:'Connecter et ajouter aux favoris',
      },
      refuse:{
        en:'Refuse',
        fr:'Refuser',
      },
      refuseAndBan:{
        en:'Refuse and ban',
        fr:'Refuser et bannir',
      },
      connectionRejected:{
        en:'Connection rejected by',
        fr:'Connection refusée par',
      },
       
    }

    return (msgs[str] && msgs[str][lang])
    ? msgs[str][lang]
    : str + ' ('+lang+')'
    ;
  }

} // end of component

const styles = StyleSheet.create({ 
  mainContainer: {
    flex: 1,
    backgroundColor:colors.background,
  },

  header:{
    alignSelf: 'stretch',
    flexDirection:'row',
    left:0,
    right:0,
    backgroundColor:'transparent',
  },

  containerPreview: {
    flex: 1,
    //flexWrap:'wrap',
    // flexDirection:'row',
    // justifyContent: 'flex-end',
   // alignItems: 'center',//'flex-end',

  },

  cam: {
    // position: 'relative',
    // margin:1,
  },


  iconButtonHeader:{
    marginLeft:0,
    marginRight:0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow:'hidden',
    height:40,
    backgroundColor:'transparent',
  },
  iconButton:{
    marginLeft:20,
    marginRight:20,
    borderRadius:50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow:'hidden',
    width:60,
    height:60,
    backgroundColor:'transparent',
    borderWidth:2,
    borderColor:colors.greenFlash,
  },

  button:{
    margin:5, 
    height:40 ,
    marginBottom:2,
    backgroundColor:'transparent',  
  },

  distantPreviewImage:{
    position:'absolute',
    top:0,
    left:0,
    backgroundColor: 'transparent',
  },
  zIndex0:{
    zIndex: 0, // works on ios
    elevation: 0, // works on android
  },
  zIndex1:{
    zIndex: 1, // works on ios
    elevation: 1, // works on android
  },

  captureLocalView:{
    width: previewWidth, 
    height: previewHeight, 
  
    borderColor: 'blue',
    position:'relative',
    // opacity:0,
  },

  captureLocal:{
    position:'absolute',
    top:0,
    left:0,

    // transform: [{ rotate: '90deg'}],
    resizeMode: 'contain', //enum('cover', 'contain', 'stretch', 'repeat', 'center')
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'green',

  },


});
