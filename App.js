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
} from 'react-native';

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
    distantStorages:false,
    distantStorage:false,
      previewing:false,
    previewDimensions:false,
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
      battery:{charging:false, level:0},
      cam:  false,
      mask: false,
      storages: [],
      storage: false,

      devices: [
        {
          user:{id:'local', name:'local', connected:true},
          distantBattery:{charging:false, level:0},
          distantStorages:false,
          distantStorage:false,
        }
      ],
      // connectedTo:false,

      imgLocal: false,

      distantCam:false,


      distantRec:false,
      distantTakingPhoto:false,
      distantSnaping:false,
      distantBattery:false,
      previewing:false,
        distantPreview0:false,
        distantPreview1:false,
        distantPreviewCurrent:0,

      previewDimensions:false,


      modalStorage:false,
    };

    this.stopRecordRequested = false;

    this.distantPreviewNumber = 0;

    this.previewScale=3;
    this.isMaster = null;
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


  testBattery(){
    NativeModules.RNioPan.getBatteryInfo()
    .then((battery) => {
      // console.log(battery); // {level: 94, charging: true}
      let device = this.getDevice('local');
      device.distantBattery = battery;

      devices = this.state.devices;
      devices[this.getDeviceIndex('local')] = device;

      this.setState({
        battery: battery,
        devices: devices,
      }, function(){
        this.sendMessage(this.state.connectedTo, 'distantBattery', battery);
      });

      setTimeout(() => { this.testBattery() }, 60000);
    })
  }
  // getBatteryLevel = (callback) => {
  //   NativeModules.RNioPan.getBatteryStatus(callback);
  // }

  componentDidMount() {
    StatusBar.setHidden(true);
    SplashScreen.hide();

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


    this.getAvailableStorages(true);
    this.testBattery();
    // this.getBatteryLevel( (batteryLevel) => { console.log(batteryLevel) }  );   

    BluetoothCP.advertise("WIFI-BT");   // "WIFI", "BT", and "WIFI-BT"
    BluetoothCP.browse('WIFI-BT');
    this.listener1 = BluetoothCP.addPeerDetectedListener(this.PeerDetected)
    this.listener2 = BluetoothCP.addPeerLostListener(this.PeerLost)
    this.listener3 = BluetoothCP.addReceivedMessageListener(this.receivedMessage)
    this.listener4 = BluetoothCP.addInviteListener(this.gotInvitation)
    this.listener5 = BluetoothCP.addConnectedListener(this.Connected)
  }


testPermissions= async () => {

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

        PermissionsAndroid.PERMISSIONS.BLUETOOTH,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      ])
      if (granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
      &&  granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
      // &&  granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
      ){
         Alert.alert('PERMiSSION OK');
      }
      else {
         Alert.alert('NO EPRMiSSION');
        // Exit app.
      }
    } catch (err) {
      Alert.alert(err);
      console.warn(err)
    }
  
}


  getAvailableStorages(setDefault){
    // console.log(RNFetchBlob.fs.dirs.CacheDir)
    // console.log(RNFetchBlob.fs.dirs.DCIMDir)

    NativeModules.RNioPan.getStorages()
    .then((dirs) => {
      if(dirs.length) {
        // console.log('getAvailableStorages', dirs);

        let updatedState;
        if(setDefault){
          let maxSpace = 0;
          let maxSpaceId = 0;
          dirs.forEach(function(item, index){
            if (item.free > maxSpace){
              maxSpace = item.free;
              maxSpaceId = index;
            }
          });
           

          let devices = this.state.devices
          devices[this.getDeviceIndex('local')].distantStorages = dirs;
          devices[this.getDeviceIndex('local')].distantStorage = maxSpaceId;

          updatedState = { storages : dirs, storage:maxSpaceId,
                devices:devices
                };
        }
        else {
          let devices = this.state.devices
          devices[this.getDeviceIndex('local')].distantStorages = dirs;

          updatedState = { storages : dirs ,
                devices:devices
          };
        }

        this.setState(updatedState, function(){



          // Create folders if not exists
          // To do v2
          this.getDevice('local').distantStorages.map((value) => {

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
                })
              }
            })

          });
        });
      }



    })
    .catch((err) => { 
      console.log('getStorages ERROR', err) 
    })
  }

  componentDidUpdate(){

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
  }

  //--------------------------------------------------------
  //            P2P communication
  //--------------------------------------------------------

  PeerDetected = (user) => {
    // console.log(user)
    //{ "connected": false, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}
    let devices = this.state.devices;
    // TODO chek if not already present in list
    devices.push({
      ...shareState,
      user:user});
    this.setState({devices:devices});
  }

  PeerLost = (user) => {
    // Alert.alert(JSON.stringify({'PeerLost':user}, undefined, 2));
    let devices = this.state.devices;

    const i = this.getDeviceIndex(user.id);
    if(i!==false){
      devices.splice(this.getDeviceIndex(user.id), 1);
      this.setState({devices:devices})
    }
    if(!this.isMaster) {
      BluetoothCP.advertise("WIFI-BT");
    }
  }

  Connected = (user) => {
    //{ "connected": true, "id": "7ea7b6331ab5c39e", "name": "ioS7", "type": "offline"}

    console.log('Connected',user)



    // Update list of devices.
    let devices = this.state.devices;
    devices[this.getDeviceIndex(user.id)].user = user;
    this.setState({
      devices:devices,
      connectedTo:user.id, // TODO multiple ids
    }, function(){

      if(!this.isMaster){
        this.sendMessage(
          user.id, 
          'fullShareSate', 
          this.getDevice('local'),
        );
      }
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
    return;
  }

  connectToDevice(id){
    BluetoothCP.inviteUser(id);
    this.isMaster = true;
  }

  gotInvitation = (user) => {
    // TODO: confirm dialog and list safe devices.
    // alert(JSON.stringify(user , undefined, 2));
    // if(this.safeIds.indexOf(user.id) >= 0) {
      BluetoothCP.acceptInvitation(user.id);
      this.isMaster = false;
    // }
  }

  sendMessage(id, key, value){
    //alert(JSON.stringify({key:key , value:value }));
    // console.log('sendMessage')
    // console.log(key, value);
    if(id){
      BluetoothCP.sendMessage(JSON.stringify({key:key , value:value }), id);
    }

    if( key=='cmd'){
      if(value=='cam' && this.state.distantCam) {
        
        this.setState({
          distantCam:false,
          distantRec:false,
          distantTakingPhoto:false,
          distantSnaping:false,
          previewing:false,
        });

        let devices = this.state.devices;
        devices[this.getDeviceIndex(id)] = {
          ...this.getDevice(id),
          distantCam:false,
          distantRec:false,
          distantTakingPhoto:false,
          distantSnaping:false,
          previewing:false,
        }

        this.setState({
          devices:devices,
        });

      }
      else if(value=='takeSnap') {
        this.setState({distantSnaping:true});

        let devices = this.state.devices;
        devices[this.getDeviceIndex(id)] = {
          ...this.getDevice(id),
          distantSnaping:false,
        }
        this.setState({
          devices:devices,
        });

      }
      else if(value=='takePicture') {
        this.setState({distantTakingPhoto:true});

        let devices = this.state.devices;
        devices[this.getDeviceIndex(id)] = {
          ...this.getDevice(id),
          distantTakingPhoto:false,
        }
        this.setState({
          devices:devices,
        });

      }

    }
  }

  receivedMessage = (user) => {
    // alert(JSON.stringify(user , undefined, 2));

    let msg = user.message;
    msg = JSON.parse(msg);

    console.log('receivedMessage',msg);

    if(msg.key == 'txt') {
      Alert.alert(msg.value);
    }

    else if( msg.key == 'distantCam' || msg.key == 'distantRec' || msg.key == 'distantMask'
       || msg.key == 'distantBattery' || msg.key == 'distantStorages'
    ) { // for button.

      
      this.setState({[msg.key]:msg.value});


      let devices = this.state.devices;
      devices[this.getDeviceIndex(user.id)] = {
        ...this.getDevice(user.id),
        [msg.key]:msg.value,
      };

      this.setState({
        devices:devices,
      });
    }

    else if( msg.key == 'setStorage' ) { 
      this.setStorage('local', msg.value);
    }

    else if( msg.key == 'fullShareSate' ) { 

      msg.value.user = this.getDevice(user.id).user; // avoid storring message.
      devices[this.getDeviceIndex(user.id)] = msg.value

      this.setState({
        devices: devices,
      }, function(){

        console.log('upd   ',this.state.devices)
      });
    }


    else if(msg.key == 'camDimensions') {
      this.setState({previewDimensions:{
        w: msg.value.split('x')[0] / this.previewScale,
        h: msg.value.split('x')[1] / this.previewScale,
      }});

      this.setState({devices:{
        ...this.state.devices,
        [user.id]:{
          ...this.state.devices[user.id],
          previewDimensions:{
            w: msg.value.split('x')[0] / this.previewScale,
            h: msg.value.split('x')[1] / this.previewScale,
          }
        }
      }});
    }

    else if(msg.key == 'cmd') {

      if(msg.value == 'cam') {
        if(this.state.cam){
          console.log('cam off')

          this.refs.cam.stopRecordRequested = true;
          this.refs.cam.camera.stopRecording();
          this.setState({cam:false});  
        }
        else {
          console.log('cam on')
          this.setState({cam:true});      
        }
      } 
      
      else if(msg.value=='toggleMask'){//ioio
        this.toggleMask()
      }

      else if(msg.value=='takePicture'){
        this.refs.cam.pictureRequested = true;
        this.refs.cam.takePicture();
      }

      else if(msg.value=='takeSnap'){
        // this.refs.cam.refs.viewShotCam.capture().then(uri => {
        //   this.sendMessage(this.state.connectedTo, 'snap', uri);
        // });
        this.refs.viewShot.capture().then(uri => {
          this.sendMessage(this.state.connectedTo, 'snap', uri);
        });
      }

      else if(msg.value=='viewShot' && this.refs.viewShot){
        this.refs.viewShot.capture().then(uri => {
          this.sendMessage(this.state.connectedTo, 'preview', uri);
        });
      }

      else if(msg.value=='startRecording'){
        this.refs.cam.videoRequested = true;
        this.refs.cam.stopRecordRequested = false;
        this.refs.cam.takeVideo();
      }
      else if(msg.value=='stopRecording'){
        this.refs.cam.stopRecordRequested = true;
        this.refs.cam.camera.stopRecording();
      }

      else{
        console.log('receivedMessage ELSE', msg.value)
        this.setState({[msg.value]:!this.state[msg.value]});
      }
    }


    else if(msg.key == 'picture' || msg.key == 'snap') {
      // console.log(this.state.connectedTo)
      console.log('--- recieve pictuer or snp or videothumb')

      // Get the name of the device that sent the photo.
      const deviceName = this.state.devices[user.id].name;
      
      // Store photo as JPEG in dedicated device folder.
      if(deviceName){
        const fileName = this.getDevice('local').distantStorages[this.getDevice('local').distantStorage].path + '/'+ deviceName + '/'  +date2folderName() + '.jpg';
        NativeModules.RNioPan.base64toJPEG(
          msg.value, 
          fileName
        ).then((result) => {
         console.log('base64toJPEG', result)
          // Output photo
          console.log('picure', fileName)
          this.setState({
            imgLocal: 'file://' + fileName,
            distantSnaping:false,
            distantTakingPhoto:false,
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


    // Preview.
    else if(msg.key == 'preview') { 
      this.distantPreviewNumber = this.distantPreviewNumber ? 0: 1;
      if(this.distantPreviewNumber==1){
        this.setState({distantPreview0:'data:image/png;base64,'+msg.value}, function(){
        });
      }
      else {
        this.setState({distantPreview1:'data:image/png;base64,'+msg.value}, function(){
        });
      }
    }
  }

  togglePreview(){
    this.setState({previewing:!this.state.previewing}, function(){
      if(this.state.previewing){
        this.sendMessage(this.state.connectedTo, 'cmd', 'viewShot');
      } 
    });
  }

  renderCamButton(device){

    if(!device.user.connected) return null;

    const titleBattery = (device.distantBattery && device.distantBattery.level)
                    ? device.distantBattery.level + '%'
                    : null
                  
    ,     titleStorage = (device.distantStorages && device.distantStorages[device.distantStorage] && device.distantStorages[device.distantStorage].free)
                    ? formatBytes(device.distantStorages[device.distantStorage].free)
                    : null
    ;
    return (
      <View style = {{flexDirection:'row'}}>

        <TouchableOpacity
          style={styles.button}
          onPress={  
            device.user.id == 'local'
            ? () => this.toggleCam()
            : () => this.sendMessage(device.user.id, 'cmd', 'cam') 
          }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
            name='camera'
            size={30}
            color={device.distantCam ? colors.greenFlash : 'white'}
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
                   color={ device.distantMask ? colors.greenFlash : 'white'}
                   backgroundColor='transparent'
              /></TouchableOpacity>


              <TouchableOpacity
                style={styles.button}
                onPress = {() => this.showStorages(device.user.id)}
                underlayColor={colors.greenSuperLight}
              ><MaterialCommunityIcons 
                   name='micro-sd'  
                   size={20}
                   color={ this.state.modalStorage ? colors.greenFlash : 'white'}
                   backgroundColor='transparent'
              >
                {/* TODO warn if batterie low level */}
                { titleStorage}
              </MaterialCommunityIcons>
              </TouchableOpacity>

              <View style={styles.button}>
                <MaterialCommunityIcons 
                  name='battery-40' 
                  color={'white'}
                  backgroundColor={'transparent'}
                  size={20}
                  style={{color:'white',width:100}}

                >
                { titleBattery}
                </MaterialCommunityIcons>
              </View>


        { !device.distantCam
          ? null
          : <View>
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ device.previewing ? colors.greenFlash : 'grey'}
              title = 'Peview'
              onPress = {() => this.togglePreview()}
            />
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ device.distantTakingPhoto ? colors.greenFlash : 'grey'}
              title = 'PHOTO'
              onPress = {() => this.sendMessage(this.state.connectedTo, 'cmd', 'takePicture')}

            />
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ this.state.distantSnaping ? colors.greenFlash : 'grey'}
              title = 'SNAP' // so we can have a snap while recording.
              onPress = {() => this.sendMessage(this.state.connectedTo, 'cmd', 'takeSnap')}

            />
            <Button 
              style={{ 
                margin:1, 
                height:40,
                marginBottom:2,
              }}
              color= { this.state.distantRec ? '#843333' : 'grey'}
              title = 'rec'
              onPress = {() => this.sendMessage(this.state.connectedTo, 'cmd', 
                                                this.state.distantRec ? 'stopRecording':'startRecording')}
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

  swichPreviewPicture(distantPreviewCurrent){

    this.setState({distantPreviewCurrent:distantPreviewCurrent}, function(){
      if(this.state.previewing){
        // this.intervalHandle = setTimeout(() => {
            this.sendMessage(this.state.connectedTo, 'cmd', 'viewShot');
        // }, 5000);
      }
    });
  }

  renderPreview(){
    if (!this.state.previewing) return null;
    if (!this.state.distantPreview0 && !this.state.distantPreview1) return null;

    return(
      <View 
        style = {[styles.distantPreviewContainer,
          
          {
          width:this.state.previewDimensions.w,
          height:this.state.previewDimensions.h,
          }]}
        >
        {!this.state.distantPreview0 
          ? null
          : <FastImage
              style = {[
                styles.distantPreviewImage, 
                {
                  width:this.state.previewDimensions.w,
                  height:this.state.previewDimensions.h,
                },
                this.state.distantPreviewCurrent == 0 
                ? styles.zIndex0 
                : styles.zIndex1 
              ]}
              source={{
                  uri: this.state.distantPreview0,
                  headers: { Authorization: 'someAuthToken' },
                  priority: FastImage.priority.high ,
              }}
              resizeMode={FastImage.resizeMode.contain}
              // onLoad={e => console.log(e.nativeEvent.width, e.nativeEvent.height)}
              onLoad={e => this.swichPreviewPicture(1)}
            />
        }
        {!this.state.distantPreview1
          ? null
          : <FastImage
              style = {[
                styles.distantPreviewImage, 
                this.state.distantPreviewCurrent == 0 ? styles.zIndex1 :styles.zIndex0 ,
                {
                  width:this.state.previewDimensions.w,
                  height:this.state.previewDimensions.h,
                },
              ]}
              source={{
                  uri: this.state.distantPreview1,
                  headers: { Authorization: 'someAuthToken' },
                  priority: FastImage.priority.high ,
              }}
              resizeMode={FastImage.resizeMode.contain}
              onLoad={e => this.swichPreviewPicture(0)}
            />
        }

      </View>
    );
  }

  toggleCam(view) { // alwas 'free'

    if( this.state.cam == view) {
      this.setState({cam:false}, function(){
        this.sendMessage(this.state.connectedTo, 'distantCam', false);
      });
    }
    else {
      this.setState({cam:view}, function(){
        this.sendMessage(this.state.connectedTo, 'distantCam', true);
      });
    }
  }

  toggleMask() {
    const devices = this.state.devices;
    devices[this.getDeviceIndex('local')].distantMask = !devices[this.getDeviceIndex('local')].distantMask;

    this.setState({devices:devices}, function(){
      this.sendMessage(this.state.connectedTo, 'distantMask', this.getDevice('local').distantMask);
    });
  }


  renderCam(){

    if(this.state.connectedTo){
      this.sendMessage(this.state.connectedTo, 'distantCam', true);
    }

    // if(!this.state.cam) {
    //   if(this.state.connectedTo && this.camRequested){
    //     this.camRequested = false;
    //     this.sendMessage(this.state.connectedTo, 'distantCam', false);
    //   }
    //   return null;     
    // }

    return (
      <ViewShot
        key="renderCamera"
        ref="viewShot"

        options={{
          format: "jpg", 
          quality:0.5,
          result:"base64",
        }}
      >
      <Cam ref="cam"
        mode='free'
        //mode_={1}
        path = {this.getDevice('local').distantStorages[ this.getDevice('local').distantStorage ].path+'/local'}
        onPictureTaken = {(info) => this.onPictureTaken(info)} // local
        onRequestedPictureTaken = {(base64) => this.sendMessage(this.state.connectedTo, 'picture', base64)} //distant

        recording =  {(isRecording) => this.sendMessage(this.state.connectedTo, 'distantRec', isRecording)}
      />
     </ViewShot> 
    );
  }

  onPictureTaken(info){
    console.log('onPictureTaken',info)
    this.setState({
      imgLocal:info.uri,
      imgLocalW:info.width,
      imgLocalH:info.height,
    })
  }

  setStorage(userId, index){
    const devices = this.state.devices;
    devices[this.getDeviceIndex(userId)].distantStorage = index;

    this.setState({devices:devices, modalStorage:false}, function(){

      if(userId != 'local') {
        this.sendMessage(this.state.connectedTo, 'setStorage', index);
      }
      else{
        // feedback
        this.sendMessage(
          this.state.connectedTo, 
          'fullShareSate', 
          this.getDevice(userId)
        );
      }
    });
  }

  render() {
    // console.log('this.state.cam', this.state.cam);
    return (
      <View style={styles.container}>


      <ScrollView style={{backgroundColor:'grey', paddingBottom:200}}>



        { // Devices.
          this.state.devices.map((value, index) => {
          //value = this.state.devices[value];
console.log('Devices foreach',value)

          // console.log('his.state.devices).map', value);
          return(

            <View 
              key = {value.user.id}

              >
  
              <Button 
                style={{ 
                  margin:1, 
                  height:40,
                  marginBottom:2,
                }}
                title = {value.user.name}
                color = {value.user.connected ? colors.greenFlash : 'grey'}
                onPress = { value.user.id!='local' ? () => this.connectToDevice(value.user.id):null}
              />
         
              { this.renderCamButton(value) }

            </View>)
          }


        // map devices
        )} 


        { this.state.cam == false 
          ? null
          : this.renderCam()
        }

        <View style={styles.containerPreview}>
          { this.renderPreview() }
        </View>
         <View style={styles.containerPreview}>
          { this.renderImageLocal() }
        </View>
      </ScrollView>


      {this.renderModalStorage()}


      {this.getDevice('local').distantMask 
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

  _t(str){
    return str;
  }

  renderModalStorage(){
    if(this.state.modalStorage===false) return null;
    
    console.log('modalStorage',  this.state.modalStorage) ;
    console.log('getDeviceIndex',  this.getDeviceIndex(this.state.modalStorage))
    console.log('distantStorages', this.state.devices[this.getDeviceIndex(this.state.modalStorage)].distantStorages)
    

    const curPath = this.getDevice(this.state.modalStorage).distantStorages[
      this.getDevice(this.state.modalStorage).distantStorage
    ].path;


    return(
        <Modal
          style={{marginTop:20}}
          animationType="slide"
          transparent={false}
          visible={this.state.modalStorage!==false}
          onRequestClose={() => this.showStorages(false)}
        >
            <View style={{ flex:1}}></View>
            <View style={{ flex:1}}>
              { this.state.devices[this.getDeviceIndex(this.state.modalStorage)].distantStorages.map((value, index) =>

                <TouchableOpacity 
                  key={index}
                  style={{
                    padding:5,
                    flexDirection:'row', 
                    flex:1, 
                    justifyContent:'center', 
                    alignItems:'center',
                  }}
                  onPress = {() => this.setStorage(this.state.modalStorage, index)} 
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
                      {formatBytes(value.free)} {this._t('libres')}</Text>
                    </View>
                  </MaterialCommunityIcons>
          
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flex:1}}></View>
        </Modal>

  
    );
  }


  showStorages(userId) {
    this.setState({modalStorage:userId});
  }
}

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
    flexWrap:'wrap',
    // flexDirection:'row',
    // justifyContent: 'flex-end',
    alignItems: 'center',//'flex-end',

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

  distantPreviewContainer:{

      width: previewWidth, 
    height: previewHeight, 
    borderColor: 'yellow',
    position:'relative',
    // opacity:0,
  },
  distantPreviewImage:{
    position:'absolute',
    top:0,
    left:0,
    // transform: [{ rotate: '90deg'}],
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'yellow',
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
