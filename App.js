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
  SectionList
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

import Cam from "./src/cam"
import { colors } from "./src/colors"
import { date2folderName, formatBytes } from './src/formatHelpers.js';

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
    previewScale:0.3,
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
          previewScale:0.3,
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
    };

    this.stopRecordRequested = false;

    this.isMaster = null;
    this.trustedUsers = {}; //key(user id):value(user name)
    this.bannedUsers = {};
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

        // PermissionsAndroid.PERMISSIONS.BLUETOOTH, // permission is null
        // PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
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
    StatusBar.setHidden(true);
    SplashScreen.hide();

     // AsyncStorage.removeItem('bannedUsers')
     // AsyncStorage.removeItem('trustedUsers')
     // AsyncStorage.removeItem('storedUsers') 
     // return;



    // this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
    //     Alert.alert(
    //       "Quiter l'application ?",
    //       "",
    //       [{
    //         text: 'Annuler',
    //         // onPress: () => {return false},
    //       },{
    //         text: 'Quitter', 
    //         onPress: () =>{RNExitApp.exitApp()},
    //       }]
    //     );
    //     return true;
    // });

        // LDPI: Portrait: 200x320px. 
        // MDPI: Portrait: 320x480px.
        // HDPI: Portrait: 480x800px. 
        // XHDPI: Portrait: 720px1280px. 
        // XXHDPI: Portrait: 960px1600px.
        // XXXHDPI: Portrait: 1280px1920px


    this.getAvailableStorages();
    this.getBatteryInfo();
    

    this.listener1 = BluetoothCP.addPeerDetectedListener(this.PeerDetected)
    this.listener2 = BluetoothCP.addPeerLostListener(this.PeerLost)
    this.listener3 = BluetoothCP.addReceivedMessageListener(this.receivedMessage)
    this.listener4 = BluetoothCP.addInviteListener(this.gotInvitation)
    this.listener5 = BluetoothCP.addConnectedListener(this.Connected)
    BluetoothCP.advertise("WIFI-BT");   // "WIFI", "BT", and "WIFI-BT"
    BluetoothCP.browse('WIFI-BT');

    // Get stored devices.
    AsyncStorage.getItem('storedUsers', (err, storedUsers) => {
      console.log('get storedUsers',storedUsers);
      
      if (err || storedUsers===null) {
        AsyncStorage.setItem('storedUsers', JSON.stringify([]));
        storedUsers=[];
        console.log('err storedUsers',storedUsers);
      }
      else {
        storedUsers = JSON.parse(storedUsers);
        console.log('ok storedUsers', storedUsers);
      }

      // Get already present devices (happend in dev when refreshing app).
      const devices = this.state.devices;
      BluetoothCP.getNearbyPeers((users)=>{
        users.forEach((user,index)=>{

            if(this.getDeviceIndex(users.id) === false    // device not  already in state
            // && this.bannedUsersIds.indexOf(user.id) < 0
            ){ // device not banned
              devices.push({...shareState,  user:user});

              // TODO auto connect if trusted
              // if(!user.connected 
              // && this.trustedUsersIds.indexOf(user.id) >=0){
              //   this.connectTo(user.id);
              // }
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
        this.setState({storedUsers:storedUsers});
        console.log('didmount',storedUsers );
      });
    });

    // AsyncStorage.getItem('trustedUsers', (err, trustedUsers) => {
    //   if (err || trustedUsers===null) {
    //     AsyncStorage.setItem('trustedUsers', JSON.stringify({}));
    //     this.trustedUsers={};
    //   }
    //   else {
    //       this.trustedUsers= JSON.parse(trustedUsers);
    //       console.log(this.trustedUsers)
    //   }
    // });

    

  }

  componentWillUnmount() {
    this.listener1.remove()
    this.listener2.remove()
    this.listener3.remove()
    this.listener4.remove()
    this.listener5.remove()
    const devices  = this.state.devices;
    this.state.devices.forEach(function(item, index){
      if (item.connected && item.user.id != 'local'){
        BluetoothCP.disconnectFromPeer(item.id);
      }
    });

    BluetoothCP.stopAdvertising();
    BluetoothCP.stopBrowsing();
  }

// testPermissions= async () => {

//     try{
//       const granted = await PermissionsAndroid.requestMultiple([
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//         PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
//         PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
//         PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
//         PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,

//         PermissionsAndroid.PERMISSIONS.BLUETOOTH,
//         PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
//       ])
//       if (granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
//       &&  granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
//       // &&  granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
//       // &&  granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
//       // &&  granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
//       // &&  granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
//       ){
//          Alert.alert('PERMiSSION OK');
//       }
//       else {
//          Alert.alert('NO EPRMiSSION');
//         // Exit app.
//       }
//     } catch (err) {
//       Alert.alert(err);
//       console.warn(err)
//     }
// }

  prevBatteryState = {level: 0, charging: false};
  getBatteryInfo(){
    NativeModules.RNioPan.getBatteryInfo()
    .then((battery) => {

      if(this.prevBatteryState.level != battery.level
      || this.prevBatteryState.charging != battery.charging){

        let devices = this.state.devices;
        devices[0].distantBattery = battery;
        this.setState({
          devices: devices,
        }, function(){
          this.sendMessage('all', 'distantBattery', battery);
        });
      }

      setTimeout(() => { this.getBatteryInfo() }, 60000);
    })
  }

  getAvailableStorages(){
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
        this.sendMessage( 'all', 'distantStorage', devices[0].distantStorage);

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


  //--------------------------------------------------------
  //            P2P communication
  //--------------------------------------------------------

  PeerDetected = (user) => {
    console.log('PeerDetected',user)
    //{ "connected": false, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}
    const storedUsers = this.state.storedUsers,
          devices = this.state.devices;

    // Check if not already present in list
    if(this.getDeviceIndex(user.id)===false){
      devices.push({...shareState, user:user});
      // this.setState({devices:devices});
    }

    // index = a.findIndex(x => x.prop2 ==="yutu");
    if(undefined===storedUsers.find(u => u.id === user.id)){ // insert it
      storedUsers.push({id:user.id, name:user.name, nearby:true,}); 
    }
    else{ // update with connected info.
      const index = storedUsers.findIndex(u => u.id === user.id);
      storedUsers[index].connected = user.connected; //{...storedUsers[index], ...user}
      storedUsers[index].name = user.name;
      storedUsers[index].nearby = true;
      // Auto connect.
      // if(storedUsers[index].trusted == 1){
      //   this.connectTo(user.id);
      // }
    }

    this.setState({
      devices:devices,
      storedUser:storedUsers,
    });

  }

  PeerLost = (lostUser) => {
    console.log('PeerLost',lostUser);

    // Check if it is only a logout or a real lost.
    BluetoothCP.getNearbyPeers((nearbyUsers)=>{
      const devices = this.state.devices,
            i = this.getDeviceIndex(lostUser.id),
            storedUsers = this.state.storedUsers,
            index = storedUsers.findIndex(o => o.id === lostUser.id),
            stillNearby = nearbyUsers.findIndex(o => o.id === lostUser.id) > -1;
      // console.log(nearbyUser)

      if(stillNearby){
        console.log('still nearby');
        devices[i].user = lostUser; // disconnected.
        storedUsers[index].connected = lostUser.connected; // disconnected.
      }
      else{
        console.log('really lost');
        devices.splice(i, 1);

        // Keep it if trusted or banned.
        if(storedUsers.find(o => o.id === lostUser.id).trusted!=0){
          delete storedUsers[index].nearby;
        }
        else{
          storedUsers.splice(index, 1);
        }
      }

      this.setState({
        devices:devices,
        storedUsers:storedUsers,
      })

    });

    if(!this.isMaster) {
      BluetoothCP.advertise("WIFI-BT");
    }
    else{
      // Master can tap on access-point icon
    }
  }

  getNearbyPeers(){
    BluetoothCP.getNearbyPeers(function(devices){
      console.log(devices)
    });
  }

  Connected = (user) => {
    // console.log('Connected',user)
    // { "connected": true, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}

    // Update list of devices.
    const devices = this.state.devices,
          storedUsers = this.state.storedUsers;

    devices[this.getDeviceIndex(user.id)].user = user;

    const index = storedUsers.findIndex(o => o.id === user.id);
    console.log(index)
    storedUsers[index].connected = true;//user.connected;

    this.setState({ devices:devices ,storedUsers:storedUsers}, function(){
      // Launch cam automatically.
      // if(!this.isMaster){
      //   if(!this.state.devices[0].distantCam){
      //     this.toggleCam();
      //   }
      //   else{
      //     // TODO send cam preview dimensions.
      //   }
      // }
      //else{
        // Tell others about me.
        this.sendMessage( user.id, 'fullShareSate', devices[0]);
      //}
    });

    // Create folder for that device on each avalable storage.
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
    BluetoothCP.stopAdvertising();
    BluetoothCP.stopBrowsing();
    return;
  }

  connectTo(id){
    BluetoothCP.inviteUser(id);
    if(this.getDeviceIndex(id) === false){

    }
    else{
      const devices = this.state.devices,
            storedUsers = this.state.storedUsers;

      devices[this.getDeviceIndex(id)].user.connected = true;

      const index = storedUsers.findIndex(o => o.id === id);
      storedUsers[index].connected = true;

      this.setState({ devices:devices ,storedUsers:storedUsers});
    }

    this.isMaster = true;
  }

  gotInvitation = (user) => {
    const stored = this.state.storedUsers.find(o => o.id === user.id);
    if(stored && stored.trusted == 1){
      BluetoothCP.acceptInvitation(user.id);
      this.isMaster = false;
    }
    else{
      alert('gotInvitation');
    }
  }

  sendMessage(userId, key, value){
    // console.log('sendMessage')
    // console.log(key, value);
    if(!userId) {
      return;
    }
    else if(userId == 'all'){
      userId=[];
      this.state.devices.forEach(function(device, index){
        if(device.user.connected){
          userId.push(device.user.id);
        }
      });
    }
    else {
      userId = [userId]
    }

    // Send message to distant device.
    userId.forEach(function(uid, index){
      BluetoothCP.sendMessage(JSON.stringify({key:key , value:value }), uid);
    });

  
    let devices = this.state.devices;
    if( key=='cmd'){
      // if(value=='distantCam' && this.state.distantCam) {
                
      //   devices[this.getDeviceIndex(userId)] = {
      //     ...this.getDevice(userId),
      //     distantCam:false,
      //     distantRec:false,
      //     distantTakingPhoto:false,
      //     distantSnaping:false,
      //     previewing:false,
      //   }

      //   this.setState({ devices:devices });

      // }

      // else 

      if(value=='takeSnap') {
        devices[this.getDeviceIndex(userId)].distantSnaping = true;
        this.setState({devices:devices});
      }
      else if(value=='takePicture') {
        devices[this.getDeviceIndex(userId)].distantTakingPhoto = true;
        this.setState({devices:devices});
      }

    }
  }

  receivedMessage = (user) => {
    // console.log('receivedMessage',msg);
    if(this.getDeviceIndex(user.id) === false) {
      return false;
    }

    const devices = this.state.devices,
          msg = JSON.parse(user.message);

    if(msg.key == 'txt') {
      Alert.alert(msg.value);
    }

    // Received order.
    else if(msg.key == 'cmd') {

      if(msg.value == 'distantCam') {
        this.toggleCam();
      } 
      
      else if(msg.value=='toggleMask'){
        this.toggleMask();
      }

      else if(msg.value=='getStorages'){
        this.getAvailableStorages();
      }

      else if(msg.value=='takePicture'){
        this.refs.cam.pictureRequested = user.id;
        this.refs.cam.takePicture();
      }

      else if(msg.value=='takeSnap'){
        // this.refs.cam.refs.viewShotCam.capture().then(uri => {
        this.refs.viewShot.capture().then(uri => {
          this.sendMessage(user.id, 'snap', uri);
        });
      }

      else if(msg.value=='viewShot' && this.refs.viewShot){
        this.refs.viewShot.capture().then(uri => {
          this.sendMessage(user.id, 'viewShot', uri);
        });
      }

      else if(msg.value=='startRecording'){
        this.refs.cam.videoRequested = user.id;
        this.refs.cam.stopRecordRequested = false;
        this.refs.cam.takeVideo();
      }
      else if(msg.value=='stopRecording'){
        this.refs.cam.stopRecordRequested = true;
        this.refs.cam.camera.stopRecording();
      }

      // else{
      //   console.log('receivedMessage ELSE', msg.value)
      //   this.setState({[msg.value]:!this.state[msg.value]});
      // }
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
          this.sendMessage(user.id, 'cmd', 'viewShot');
        }
      });
    }

    else if(msg.key == 'previewDimensions') {
      devices[this.getDeviceIndex(user.id)].previewDimensions = {
            w: msg.value.split('x')[0] ,
            h: msg.value.split('x')[1] ,
          };
      this.setState({devices:devices});
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
    else if(msg.key == 'viewShot') { 
      if(devices[this.getDeviceIndex(user.id)].distantPreviewCurrent==0){
        devices[this.getDeviceIndex(user.id)].distantPreview0 = 'data:image/png;base64,'+msg.value;
        devices[this.getDeviceIndex(user.id)].distantPreviewCurrent = 1; 
      }
      else {
        devices[this.getDeviceIndex(user.id)].distantPreview1 = 'data:image/png;base64,'+msg.value
        devices[this.getDeviceIndex(user.id)].distantPreviewCurrent = 0; 
      }
      this.setState({devices:devices});
    }
  }

  renderCamButton(device){

    if(!device.user.connected) return null;

    const titleStorage = (device.distantStorages && device.distantStorages[device.distantStorage] && device.distantStorages[device.distantStorage].free)
                    ? formatBytes(device.distantStorages[device.distantStorage].free)
                    : null
    ;
    return (
      <View style = {{flexDirection:'row', backgroundColor:'white'}}>

        <TouchableOpacity
          style={styles.button}
          onPress={  
            device.user.id == 'local'
            ? () => this.toggleCam()
            : () => this.sendMessage(device.user.id, 'cmd', 'distantCam') 
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
            : () => this.sendMessage(device.user.id, 'cmd', 'toggleMask')
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




        { !device.distantCam
          ? null
          : <View>
            
            { device.user.id  == 'local'
            ? null
            : <View
              // preview options
                >
                <TouchableOpacity
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

              </View>
            }

            <TouchableOpacity
              style={styles.button}
              underlayColor={colors.greenSuperLight}
              onPress = {
                device.user.id == 'local'
                ? () => {} // TODO
                : () => this.sendMessage(device.user.id, 'cmd', 'takePicture')
              }
            ><MaterialCommunityIcons 
                 name='camera'
                 size={20}
                 color={ device.distantTakingPhoto ? colors.greenFlash : 'grey'}
                 backgroundColor='transparent'
            />
            </TouchableOpacity>
           
            { device.user.id  == 'local'
            ? null
            : <Button 
                style={{ 
                  margin:1, 
                  height:40 ,
                  marginBottom:2,
                }}
                color={ device.distantSnaping ? colors.greenFlash : 'grey'}
                title = 'SNAP' // so we can have a snap while recording.
                onPress = {() => this.sendMessage(device.user.id, 'cmd', 'takeSnap')}
              />
            }

            <Button 
              style={{ 
                margin:1, 
                height:40,
                marginBottom:2,
              }}
              color= { device.distantRec ? '#843333' : 'grey'}
              title = 'rec'
              onPress = {
                device.user.id == 'local'
                ? () => {} // TODO
                : () => this.sendMessage(device.user.id, 'cmd', 
                          device.distantRec ? 'stopRecording':'startRecording')
              }
            />


            {/*     
            <Button 
              style={{ 
                margin:1, 
                height:40,
                marginBottom:2,
              }}
              title = 'send toto'
              onPress = {() => this.sendMessage(value.id, 'txt', 'toto')}
            />
            */}
            </View>
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
    const devices = this.state.devices;
    devices[this.getDeviceIndex(device.user.id)].previewRotation 
    = (devices[this.getDeviceIndex(device.user.id)].previewRotation + 90)%360; 

    this.setState({devices:devices});
  }

  renderPreview(value){
    // console.log('renderPreview ', value);
    if (!value.user.connected || !value.distantCam || !value.previewing
    || (!value.distantPreview0 && !value.distantPreview1)
    || !value.previewDimensions || !value.previewScale
    )
    return null;

let w,h;


console.log('renderPreview',value.previewScale)

console.log('renderPreview dim ',value.previewDimensions)
console.log('renderPreview dim ',value.previewDimensions)
console.log('renderPreview dim parsed w ',parseInt(value.previewDimensions.w*value.previewScale,10))
console.log('renderPreview dim parsed h ',parseInt(value.previewDimensions.h*value.previewScale,10))

    return(
      <View 
        style={{
          flex:1,
          backgroundColor:'red',
          alignSelf:'stretch',
          alignItems:'center',
        }}
        >
                <TouchableOpacity
                  style={{alignSelf:'stretch', height:40, width:40,}} 
                  underlayColor={colors.greenSuperLight}
                  onPress = {() => this.rotatePreview(value)}
                ><MaterialCommunityIcons 
                     name='phone-rotate-landscape'  
                     size={20}
                     color={'white'}
                     backgroundColor='transparent'
                />
                </TouchableOpacity>
        <Slider  
          ref="distantPreviewQuality"
          style={{alignSelf:'stretch', height:40,}} 
          thumbTintColor = '#ffffff' 
          minimumTrackTintColor='#dddddd' 
          maximumTrackTintColor='#ffffff' 
          minimumValue={0}
          maximumValue={1}
          step={0.1}
          value={value.distantPreviewQuality}
          onValueChange={(quality) => this.sendMessage(value.user.id, 'setPreviewQuality', quality)}
        />
        <Slider  
          ref="previewScale"
          style={{alignSelf:'stretch', height:40,}} 
          thumbTintColor = '#ffffff' 
          minimumTrackTintColor='#dddddd' 
          maximumTrackTintColor='#ffffff' 
          minimumValue={0.2}
          maximumValue={1}
          step={0.1}
          value={value.previewScale}
          onValueChange={(scale) => this.setPreviewScale(value.user.id,scale)}
        />
    <View 
          style = {{flexDirection:'row', flex:1}}>

          <Text>,dfdfv,m</Text>
        <View 
          style = {[
            value.previewRotation
              ? { transform: [{ rotate: value.previewRotation+"deg" }]}
              : null,
            {
              left:0,
              top:0,
              position:'relative',
              width:parseInt(value.previewDimensions.w*value.previewScale,10),
              height:parseInt(value.previewDimensions.h*value.previewScale,10),
            },
          ]}
          >
          {!value.distantPreview0 
            ? null
            : <FastImage
                style = {[
                  styles.distantPreviewImage, 
                  value.distantPreviewCurrent == 0 
                  ? styles.zIndex0 
                  : styles.zIndex1,
                  {
                    width:parseInt(value.previewDimensions.w*value.previewScale,10),
                    height:parseInt(value.previewDimensions.h*value.previewScale,10),
                  },
                ]}
                source={{
                    uri: value.distantPreview0,
                    headers: { Authorization: 'someAuthToken' },
                    priority: FastImage.priority.high ,
                }}
                resizeMode={FastImage.resizeMode.contain}
                // onLoad={e => console.log(e.nativeEvent.width, e.nativeEvent.height)}
                onLoad={e => this.sendMessage(value.user.id, 'cmd', 'viewShot')}
              />
          }
          {!value.distantPreview1
            ? null
            : <FastImage
                style = {[
                  styles.distantPreviewImage, 
                  value.distantPreviewCurrent == 0 
                  ? styles.zIndex1 
                  : styles.zIndex0,
                  {
                    width:parseInt(value.previewDimensions.w*value.previewScale,10),
                    height:parseInt(value.previewDimensions.h*value.previewScale,10),
                  },
                ]}
                source={{
                    uri: value.distantPreview1,
                    headers: { Authorization: 'someAuthToken' },
                    priority: FastImage.priority.high ,
                }}
                resizeMode={FastImage.resizeMode.contain}
                onLoad={e => this.sendMessage(value.user.id, 'cmd', 'viewShot')}
              />
          }

        </View>
        </View>
      </View>
    );
  }

  setPreviewScale(userId,scale){
        const devices = this.state.devices,
          deviceIndex = this.getDeviceIndex(userId);

        devices[deviceIndex].previewScale = scale;
        this.setState({devices:devices});
  }

  toggleCam() { // Local cam.
    const devices = this.state.devices;
    devices[0].distantCam = !devices[0].distantCam;
    this.setState({devices:devices}, function() {
      this.sendMessage('all', 'distantCam', devices[0].distantCam);
    });
  }

  togglePreview(userId) { // Distant cam.
    const devices = this.state.devices,
          deviceIndex = this.getDeviceIndex(userId);

    devices[deviceIndex].previewing = !devices[deviceIndex].previewing;
    this.setState({devices:devices}, function(){
      if (devices[deviceIndex].previewing){
        this.sendMessage(userId, 'cmd', 'viewShot');
      }
    });
  }

  toggleMask() {
    const devices = this.state.devices;
    devices[0].distantMask = !devices[0].distantMask;

    if(devices[0].distantMask){
      NativeModules.RNioPan.hideNavigationBar();
    } 
    else{
      NativeModules.RNioPan.showNavigationBar();
    }


    this.setState({devices:devices}, function(){
      this.sendMessage('all', 'distantMask', devices[0].distantMask);
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

        onLayout={(event) => this.sendMessage(
          // TODO: Tricky if cam is already ready before connection. 
          'all',
          'previewDimensions',
          event.nativeEvent.layout.width+'x'+event.nativeEvent.layout.height
        )}

        options={{
          format: "jpg", 
          quality: this.state.devices[0].distantPreviewQuality,
          result:"base64",
        }}
      >
      <Cam ref="cam"
        mode='free'
        //mode_={1}
        path = {this.getDevice('local').distantStorages[ this.getDevice('local').distantStorage ].path+'/local'}
        onPictureTaken = {(info) => this.onPictureTaken(info)} // local
        onRequestedPictureTaken = {(userId, base64) => this.sendMessage(userId, 'picture', base64)} //distant
        recording =  {(isRecording) => this.sendMessage('all', 'distantRec', isRecording)}
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
    const devices = this.state.devices;
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
      <View style={styles.container}>

      <ScrollView style={{flex:1, backgroundColor:'grey', paddingBottom:200}}>
        { // Devices.
          this.state.devices.map((value, index) => {
          // console.log('render map value', value);
          return(
            <View 
              key = {value.user.id}
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
                    }
                  ]}
                  activeOpacity={ value.user.id=='local' 
                    ? 1
                    : 0.2
                  }
                  onPress = { value.user.id=='local' 
                    ? null
                    : value.user.connected
                      ? () => BluetoothCP.disconnectFromPeer(value.user.id)
                      : () => this.connectTo(value.user.id)
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
                    ><MaterialCommunityIcons 
                         name='access-point'
                         size={40}
                         color={'white'}
                         backgroundColor='transparent'
                    />
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
    const levelRound = Math.round(bat.level / 10) * 10;
    if(levelRound == 0){
      name += '-outline';
    }
    else{
      name += '-'+levelRound;
    }
    if(name=='battery-100'){
      name = 'battery';
    }
    return name;
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
    }

    return (msgs[str] && msgs[str][lang])
    ? msgs[str][lang]
    : str + ' ('+lang+')'
    ;
  }


  showStorages(userId) {
    this.sendMessage(userId, 'cmd', 'getStorages');
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
    if(visible){
      BluetoothCP.advertise("WIFI-BT");   // "WIFI", "BT", and "WIFI-BT"
      BluetoothCP.browse('WIFI-BT');
      this.setState({modalDevices:visible});
    }
    else{
      BluetoothCP.stopAdvertising();
      BluetoothCP.stopBrowsing();
      this.setState({modalDevices:visible});
    }
  }

  renderModalDevices(){
    if(this.state.modalDevices===false) 
      return null;

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
        <View
          style={{ flex:0.3, backgroundColor:'transparent',
              alignItems:'center', justifyContent:'center', marginBottom:1, padding:10}}
          >
          <Text style={{fontWeight:'normal', fontSize:26, color:'grey'}}>
            {this._t('distantDevices')}
          </Text>

        </View>
        <SectionList
          style={{ flex:1}}
          sections={DATA}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }) => this.renderUser(item)}

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
              {this._t(title)}</Text></View>
          )}

          renderSectionFooter={({ section: { data } }) => (
            !data.length
            ?  <View style={{alignItems:'center', padding:5,backgroundColor:'transparent', height:50}}><Text style={{color:'grey'}}>({this._t('none')})</Text></View>
            :  <View
              style={{ backgroundColor:'transparent', height:50}}
              ></View>
          )}
        />
      </Modal>
    );
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
          onPress = { user.nearby
            ? user.connected
              ? () => BluetoothCP.disconnectFromPeer(user.id)
              : () => this.connectTo(user.id)
            : null
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
              onPress = {() => this.storeUserStatus(user,-1)} 
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
    const storedUsers = this.state.storedUsers,
          index = storedUsers.findIndex(o => o.id === user.id);

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
      if(trusted!=0){
        delete o[index].nearby;
        delete o[index].connected;
      }
      AsyncStorage.setItem('storedUsers', JSON.stringify(o));
    });
  }


} // end of component

const styles = StyleSheet.create({ 
  container: {
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
    // transform: [{ rotate: '90deg'}],
    backgroundColor: 'transparent',
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
  zIndex0:{
    zIndex: 0, // works on ios
    elevation: 0, // works on android
  },
  zIndex1:{
    zIndex: 1, // works on ios
    elevation: 1, // works on android
  }

});
