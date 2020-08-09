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
import { date2folderName } from './src/formatHelpers.js';

const previewHeight = 264;
const previewWidth = 200;

//-----------------------------------------------------------------------------------------
export default class App extends Component<Props> {
//-----------------------------------------------------------------------------------------
  constructor(props) {
    super(props);
    this.state = {
      battery:{charging:false, level:0},
      devices: [],
      connectedTo:false,

      imgLocal: false,

      distantCam:false,
      distantMask:false,
      distantRec:false,
      distantTakingPhoto:false,
      distantSnaping:false,
      distantBattery:false,
      previewing:false,
        distantPreview0:false,
        distantPreview1:false,
        distantPreviewCurrent:0,

      cam:  'collection-form',
      mask: false,
      storages: [],
      storage: false,
    };

    this.camRequested = false;
    this.stopRecordRequested = false;

    this.distantPreviewNumber = 0;
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
      this.setState({battery:battery}, function(){
        this.sendMessage(this.state.connectedTo, 'battery', battery);
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


    this.testBattery();
    // this.getBatteryLevel( (batteryLevel) => { console.log(batteryLevel) }  );   

    BluetoothCP.advertise("WIFI-BT");   // "WIFI", "BT", and "WIFI-BT"
    BluetoothCP.browse('WIFI-BT');
    this.listener1 = BluetoothCP.addPeerDetectedListener(this.PeerDetected)
    this.listener2 = BluetoothCP.addPeerLostListener(this.PeerLost)
    this.listener3 = BluetoothCP.addReceivedMessageListener(this.receivedMessage)
    this.listener4 = BluetoothCP.addInviteListener(this.gotInvitation)
    this.listener5 = BluetoothCP.addConnectedListener(this.Connected)

    this.getAvailableStorages();
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


  getAvailableStorages(){
    // console.log(RNFetchBlob.fs.dirs.CacheDir)
    // console.log(RNFetchBlob.fs.dirs.DCIMDir)

    NativeModules.RNioPan.getExternalStorages()
    .then((dirs) => {
      console.log('getAvailableStorages',JSON.parse(dirs));

      if(dirs.length) {
        this.setState({
          storages : JSON.parse(dirs),
          storage:JSON.parse(dirs)[0].path,
        }, function(){
          // Create folders if not exists
          this.state.storages.map((value) => {

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
      console.log('getExternalStorages ERROR', err) 
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

    let devices = this.state.devices;
    devices.forEach(function(item, index){
      if (item.connected){
        BluetoothCP.disconnectFromPeer(item.id);
      }
    });

    BluetoothCP.stopAdvertising();
  }

  //--------------------------------------------------------
  //            P2P communication
  //--------------------------------------------------------

  PeerDetected = (user) => {
    // Alert.alert(JSON.stringify({'PeerDetected':user}, undefined, 2));
    let devices = this.state.devices;
    devices.push(user);
    this.setState({devices:devices});
  }

  PeerLost = (user) => {
    // Alert.alert(JSON.stringify({'PeerLost':user}, undefined, 2));
    let devices = this.state.devices;
    let i = false;
    devices.forEach(function(item, index){
      if (item.id == user.id){
        i = index;
        return;
      }
    });
    if (i!==false){
      devices.splice(i, 1);
    }
    this.setState({devices:devices})
    BluetoothCP.advertise("WIFI-BT");
  }

  Connected = (user) => {
    // Alert.alert(JSON.stringify({'Connected':user}, undefined, 2));

    console.log('Connected',user)

    let devices = this.state.devices;
    devices.forEach((item, index)=>{
      if (item.id == user.id){
        devices[index] = user;
        this.setState({devices:devices, connectedTo:user.id})
        
        // Create folder for that device on each avalable storage.
        this.state.storages.map((value) => {

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
    });

  }

  connectToDevice(id){
    BluetoothCP.inviteUser(id);
  }

  gotInvitation = (user) => {
    // TODO: confirm dialog and list safe devices.
    // alert(JSON.stringify(user , undefined, 2));
    // if(this.safeIds.indexOf(user.id) >= 0) {
      BluetoothCP.acceptInvitation(user.id);
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
        this.setState({distantCam:false});
      }
      else if(value=='takeSnap') {
        this.setState({distantSnaping:true});
      }
      else if(value=='takePicture') {
        this.setState({distantTakingPhoto:true});
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
    else if(msg.key == 'distantCam') { // for button.
      this.setState({distantCam:msg.value});
    }
    else if(msg.key == 'distantRec') { // for button.
      this.setState({distantRec:msg.value});
    }
    else if(msg.key == 'distantMask') { // for button.
      this.setState({distantMask:msg.value});
    }
    else if(msg.key == 'battery') {
      this.setState({distantBattery:msg.value});
    }

    else if(msg.key == 'cmd') {

      if(msg.value == 'cam') {
        if(this.state.cam=='free'){
          console.log('cam off')
          this.camRequested = false;
          this.setState({cam:'collection-form'});  
        }
        else {
          console.log('cam on')
          this.camRequested = true;
          this.setState({cam:'free'});      
        }
      } 
      
      else if(msg.value=='toggleMask'){
        this.toggleMask()
      }

      else if(msg.value=='takePicture'){
        this.refs.cam.pictureRequested = true;
        this.refs.cam.takePicture();
      }

      else if(msg.value=='takeSnap'){
        this.refs.viewShot.capture().then(uri => {
          console.log('got snap request')
          this.sendMessage(this.state.connectedTo, 'snap', uri);
        });
      }

      else if(msg.value=='viewShot' && this.refs.viewShot){
        this.refs.viewShot.capture().then(uri => {
          this.sendMessage(this.state.connectedTo, 'img', uri);
        });
      }

      else if(msg.value=='startRecording'){
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
      // console.log(this.state.devices)

      // Get the name of the device that sent the photo.
      let deviceName = false;
      this.state.devices.forEach((item, index)=>{
        if (item.id == this.state.connectedTo){
          deviceName = item.name.replace(/ /g, "-");
        }
      });
      
      // Store photo as JPEG in dedicated device folder.
      if(deviceName){
        const fileName = this.state.storage+ '/'+ deviceName + '/'  +date2folderName() + '.jpg';
        NativeModules.RNioPan.base64toJPEG(
          msg.value, 
          fileName
        ).then((result) => {

          // Output photo
          this.setState({
            imgLocal: 'file://' + fileName,
            distantSnaping:false,
            distantTakingPhoto:false,
          })
        });
      }
    }


    // Preview.
    else if(msg.key == 'img') { 
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

  renderCamButton(value){
   
    if(!value.connected) return null;

    return (
      <View>
        <TouchableOpacity
          style={styles.button}
          onPress={  () => this.sendMessage(value.id, 'cmd', 'cam') }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
            name='camera'
            size={30}
            color={this.state.distantCam ? '#338433' : 'white'}
            backgroundColor='transparent'
        /></TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={  () => this.sendMessage(value.id, 'cmd', 'toggleMask') }
          underlayColor={colors.greenSuperLight}
        ><MaterialCommunityIcons 
            name='power-sleep'
            size={30}
            color={this.state.distantMask ? '#338433' : 'white'}
            backgroundColor='transparent'
        /></TouchableOpacity>

        { !this.state.distantCam
          ? null
          : <View>
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ this.state.previewing ? '#338433' : 'grey'}
              title = 'Peview'
              onPress = {() => this.togglePreview()}
            />
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ this.state.distantTakingPhoto ? '#338433' : 'grey'}
              title = 'PHOTO'
              onPress = {() => this.sendMessage(this.state.connectedTo, 'cmd', 'takePicture')}

            />
            <Button 
              style={{ 
                margin:1, 
                height:40 ,
                marginBottom:2,
              }}
              color={ this.state.distantSnaping ? '#338433' : 'grey'}
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
          style = {styles.captureLocal}
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
        style = {styles.captureLocalView}
        >
        {!this.state.distantPreview0 
          ? null
          : <FastImage
              style = {[styles.captureLocal, this.state.distantPreviewCurrent == 0 ? styles.zIndex0 :styles.zIndex1 ]}
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
              style = {[styles.captureLocal, this.state.distantPreviewCurrent == 0 ? styles.zIndex1 :styles.zIndex0 ]}
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

  toggleView(view) { // alwas 'free'
    if( this.state.cam == view) {
      this.setState({cam:'collection-form'}, function(){
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
    this.setState({mask:!this.state.mask}, function(){
      this.sendMessage(this.state.connectedTo, 'distantMask', this.state.mask);
    });
  }


  renderCam(){
    // console.log('-----renderCam');
    // console.log('connectedTo',this.state.connectedTo);
    // console.log('camRequested',this.camRequested);

    if(this.state.connectedTo && this.camRequested){
      this.camRequested = false;
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
        mode_={1}
        path = {this.state.storage+'/local'}
        onPictureTaken = {(pic) => this.onPictureTaken(pic)} // local
        onRequestedPictureTaken = {(base64) => this.sendMessage(this.state.connectedTo, 'picture', base64)} //distant

        recording =  {(isRecording) => this.sendMessage(this.state.connectedTo, 'distantRec', isRecording)}
      />
     </ViewShot> 
    );
  }

  onPictureTaken(pic){
   console.log('onPictureTaken',pic);
    this.setState({imgLocal:pic})
  }

  setStorage(val){
    this.setState({storage:val.path});
  }
  render() {
    // console.log('this.state.cam', this.state.cam);
    return (
      <View style={styles.container}>

        <View style={styles.header}>
          <ScrollView horizontal={true}>


            <TouchableOpacity
              style={styles.button}
              onPress = {() => this.testPermissions()}
              underlayColor={colors.greenSuperLight}
            ><MaterialCommunityIcons 
                 name='power-sleep' // MASK
                 size={30}
                 color={ this.state.cam=='free' ? colors.greenFlash : 'grey'}
                 backgroundColor='transparent'
            /></TouchableOpacity>


            <TouchableOpacity
              style={styles.button}
              onPress = {() => this.toggleMask()}
              underlayColor={colors.greenSuperLight}
            ><MaterialCommunityIcons 
                 name='power-sleep' // MASK
                 size={30}
                 color={ this.state.cam=='free' ? colors.greenFlash : 'grey'}
                 backgroundColor='transparent'
            /></TouchableOpacity>

            <View style={{ flexDirection:'row', flex:1}}>
              { this.state.storages.map((value, index) =>
                <TouchableOpacity 
                  key={index}
                  style={{padding:5,
                    flexDirection:'row', flex:0.5, justifyContent:'center', alignItems:'center',
                  }}
                  onPress = {() => this.setStorage(value)} 
                  >
                  <MaterialCommunityIcons
                    name={ value.type=='phone' ? "cellphone-android" : "micro-sd" }
                    style={{
                      backgroundColor:'transparent',
                      // color:this.state.storage.path==value.path ? colors.greenFlash :'grey',
                      color:this.state.storage==value.path ? colors.greenFlash :'grey',
                    }}
                    size={25}
                  />
                  <Text style={{fontSize:16,
                    color:this.state.storage==value.path ? colors.greenFlash :'grey',
                    }}>
                  { /*value.type=='phone' ? "Téléphone" : "Carte SD" */}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress = {() => this.toggleView('free')}
              underlayColor={colors.greenSuperLight}
            ><MaterialCommunityIcons 
                 name='camera'
                 size={30}
                 color={ this.state.cam=='free' ? colors.greenFlash : 'grey'}
                 backgroundColor='transparent'
            /></TouchableOpacity>
 

          </ScrollView>
        </View> 

      <ScrollView style={{backgroundColor:'grey', paddingBottom:200}}>

        { this.state.cam == 'collection-form' || this.state.cam =='login'
          ? null
          : this.renderCam()
        }


        { // Distant devices.
          this.state.devices.map((value, index) => 
          <View 
            key = {index}
            style = {{flexDirection:'row'}}
            >
            <Button 
              style={{ 
                margin:1, 
                height:40,
                marginBottom:2,
              }}
              title = {(this.state.distantBattery && this.state.distantBattery.level)
                        ? value.name + ' ' + this.state.distantBattery.level + '%'
                        : value.name
                      }
              color = {value.connected ? '#338433' : 'grey'}
              onPress = {() => this.connectToDevice(value.id)}
            />
            { this.renderCamButton(value) }
          </View>
        )}



        <View style={styles.containerPreview}>
          { this.renderPreview() }
        </View>
         <View style={styles.containerPreview}>
          { this.renderImageLocal() }
        </View>
      </ScrollView>



      {this.state.mask 
      ? <TouchableOpacity ref="black_mask_to_save_battery"
          style={{
            position:'absolute', backgroundColor:'black', top:0,bottom:0,left:0,right:0,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection:'row',
          }}
          onPress = {() => this.toggleMask()}
        >
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
        </TouchableOpacity>
      :null
      }

      </View>
    );
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
    margin:1, 
    height:40 ,
    marginBottom:2,
    backgroundColor:'transparent',  
  },

  captureLocalView:{
    width: previewWidth, 
    height: previewHeight, 
  
    borderColor: 'red',
    position:'relative',
    // opacity:0,
  },

  captureLocal:{
    position:'absolute',
    top:0,
    left:0,
    width: previewWidth, 
    height: previewHeight, 
    // transform: [{ rotate: '90deg'}],
    resizeMode: 'contain', //enum('cover', 'contain', 'stretch', 'repeat', 'center')
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'red',

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
