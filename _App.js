import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View,
  ScrollView,
  Button,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  NativeModules,
  StatusBar,
} from 'react-native';

import SplashScreen from "rn-splash-screen";
import KeepScreenOn from 'react-native-keep-screen-on';
import RNFetchBlob from 'rn-fetch-blob';
import ViewShot from "react-native-view-shot";
import BluetoothCP  from "react-native-bluetooth-cross-platform"
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Cam from "./src/cam"
import { colors } from "./src/colors"

//-----------------------------------------------------------------------------------------
export default class App extends Component<Props> {
//-----------------------------------------------------------------------------------------
  constructor(props) {
    super(props);
    this.state = {
      battery:{charging:false, level:0},
      devices: [],
      connectedTo:false,
      distantPicture:false,
      imgLocal: false,
      imgTest:false,//'file:///'+RNFetchBlob.fs.dirs.DCIMDir+'/test.jpg',
      distantcam:false,
      previewing:false,
      distantRec:false,

      cam:  'collection-form',
    };
  }

  // TODO: re-think permissions.
  requestForPermission = async () => {
    try{
      const granted = await PermissionsAndroid.requestMultiple([

        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,

        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
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
      // NativeModules.ioPan.getBatteryInfo()
      // .then((battery) => {
      //   if(!this.state.bigBlackMask){
      //     this.setState({battery:battery});
      //   }
      //   console.log(battery.level);
      //   if (battery.level < 15) {
      //     // TODO send alert (to distant).
      //   }
      // })

  }
  // getBatteryLevel = (callback) => {
  //   NativeModules.ioPan.getBatteryStatus(callback);
  // }




  componentDidMount() {
    StatusBar.setHidden(true);
    SplashScreen.hide();
        // LDPI: Portrait: 200x320px. 
        // MDPI: Portrait: 320x480px.
        // HDPI: Portrait: 480x800px. 
        // XHDPI: Portrait: 720px1280px. 
        // XXHDPI: Portrait: 960px1600px.
        // XXXHDPI: Portrait: 1280px1920px

    // this.getBatteryLevel(
    //   (batteryLevel) => {
    //     console.log(batteryLevel);
    //   }
    // );

    // TODO move this to specific component.
    // setInterval(() => {this.testBattery()}, 60000);
    KeepScreenOn.setKeepScreenOn(true);

    this.requestForPermission();



    // BluetoothCP.advertise("WIFI");   // "WIFI", "BT", and "WIFI-BT"
    // BluetoothCP.browse('WIFI');
    // this.listener1 = BluetoothCP.addPeerDetectedListener(this.PeerDetected)
    // this.listener2 = BluetoothCP.addPeerLostListener(this.PeerLost)
    // this.listener3 = BluetoothCP.addReceivedMessageListener(this.receivedMessage)
    // this.listener4 = BluetoothCP.addInviteListener(this.gotInvitation)
    // this.listener5 = BluetoothCP.addConnectedListener(this.Connected)
  }

  componentDidUpdate(){

  }

  componentWillUnmount() {
    // this.listener1.remove()
    // this.listener2.remove()
    // this.listener3.remove()
    // this.listener4.remove()
    // this.listener5.remove()

    // let devices = this.state.devices;
    // devices.forEach(function(item, index){
    //   if (item.connected){
    //     BluetoothCP.disconnectFromPeer(item.id);
    //   }
    // });

    // BluetoothCP.stopAdvertising();
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
    // BluetoothCP.advertise("WIFI-BT");
  }

  Connected = (user) => {
    // Alert.alert(JSON.stringify({'Connected':user}, undefined, 2));
    let devices = this.state.devices;
    devices.forEach((item, index)=>{
      if (item.id == user.id){
        devices[index] = user;
        this.setState({devices:devices, connectedTo:user.id})
        // BluetoothCP.stopAdvertising();
        return;
      }
    });
  }

  connectToDevice(id){
    // BluetoothCP.inviteUser(id);
  }

  gotInvitation = (user) => {
    // TODO: confirm dialog and list safe devices.
    // alert(JSON.stringify(user , undefined, 2));
    // if(this.safeIds.indexOf(user.id) >= 0) {
// BluetoothCP.acceptInvitation(user.id);
    // }
  }

  sendMessage(id, key, value){
    //alert(JSON.stringify({key:key , value:value }));
    console.log(key, value);
    if(id){
      // BluetoothCP.sendMessage(JSON.stringify({key:key , value:value }), id);
    }
  }

  receivedMessage = (user) => {
    // alert(JSON.stringify(user , undefined, 2));

    let msg = user.message;
    msg = JSON.parse(msg);
    console.log(msg);
    if(msg.key == 'txt') {
      Alert.alert(msg.value);
    }
    else if(msg.key == 'distantcam') { // for button.
      this.setState({distantcam:msg.value});
    }
    else if(msg.key == 'distantRec') { // for button.
      this.setState({distantRec:msg.value});
    }

    else if(msg.key == 'cmd') {

      if(msg.value == 'cam') {
        // this.camRequested = true;
        this.setState({cam:'free'});
      } 
      
      if(msg.value=='takePicture'){
        this.pictureRequested = true;
        this.takePicture();
      }
      else if(msg.value=='startRecording'){
        this.stopRecordRequested = false;
        this.takeVideo();
      }
      else if(msg.value=='stopRecording'){
        this.stopRecordRequested = true;
        this.camera.stopRecording();
      }

      else{
        this.setState({[msg.value]:!this.state[msg.value]});
      }
    }

    else if(msg.key == 'img') {
      this.setState({distantPicture:'data:image/png;base64,'+msg.value}, function(){
        if(this.state.previewing){
          this.sendMessage(this.state.connectedTo, 'cmd', 'takePicture');
        }
      });
    }
  }

  // todo: both options: snap & real picture
  snap(){
    this.sendMessage(this.state.connectedTo, 'cmd', 'takePicture');
  }
  
  togglePreview(){
    this.setState({previewing:!this.state.previewing}, function(){
      if(this.state.previewing){
        this.sendMessage(this.state.connectedTo, 'cmd', 'takePicture');
      } 
    });
  }

  toggleRecord(){
    if(this.state.distantRec){
      this.sendMessage(this.state.connectedTo, 'cmd', 'stopRecording');
    }
    else{
      this.sendMessage(this.state.connectedTo, 'cmd', 'startRecording');
    } 
  }




  renderOtherButtons(value){
    if(!value.connected || !this.state.distantcam) 
      return null;

    return (
      <View>
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
        color={ this.state.previewing ? '#338433' : 'grey'}
        title = 'SNAP'
        onPress = {() => this.snap()}
      />
      <Button 
        style={{ 
          margin:1, 
          height:40,
          marginBottom:2,
        }}
        color= { this.state.distantRec ? '#843333' : 'grey'}
        title = 'rec'
        onPress = {() => this.toggleRecord()}
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
    );
  }

  renderCamButton(value){
    if(!value.connected) 
      return null;

    return (
      <View>
      <Button 
        style={{ 
          margin:1, 
          height:40,
          marginBottom:2,
        }}
        color={this.state.distantcam ? '#338433' : 'grey'}
        title='cam'
        onPress={() => this.sendMessage(value.id, 'cmd', 'cam')}
      />
      { this.renderOtherButtons(value) }
      </View>
    );
  }


  toggleView(view) {
    this.setState({cam:view});
  }

  toggleBigBlackMask() {
    this.setState({bigBlackMask:!this.state.bigBlackMask});
  }

  pickPhoto(collection_id, field){
    // alert(collection_id + ' '+ field)
    this.setState({cam:'collection--' + collection_id +'--'+ field});
  }





  render() {
    console.log(this.state.cam);
    return (
      <View style={styles.container}>

        <View style={styles.header}>
          <ScrollView horizontal={true}>
            <Button 
              style={styles.button}
              color={ !this.state.bigBlackMask ?  'grey' : '#338433' }
              title = 'mask' 
              onPress = {() => this.toggleBigBlackMask()}
            />


            <View style={styles.iconButtonHeader}>
            <MaterialCommunityIcons.Button   
              borderRadius={0}
              name='camera'
              size={30}
              color={ this.state.cam=='free' ? colors.greenFlash : 'grey'}
              // backgroundColor = { this.state.cam !='collection-form' ? colors.greenFlash : 'white'}
              backgroundColor='transparent'
              onPress = {() => this.toggleView('free')}
            />
            </View>


          </ScrollView>
        </View> 


        {/*        
        <ScrollView style={{backgroundColor:'red', paddingBottom:200}}>*/}

        {/*
        <View style={styles.containerPreview}>
          { this.renderDistantPicture() }
          { this.renderImageTest() }
          { this.renderImageLocal() }
       </View>
        */}


        { this.state.cam == 'collection-form' || this.state.cam =='login'
          ? null
          : <Cam
              mode='free'
              mode_={1}
              
            />
        }
 
        <View style={this.state.cam!='collection-form' ? {height:0}:{flex:1}}>


        </View>
       



        {/*      
        <View style={{height:500}}></View>
      </ScrollView>
      */}



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
              title = {value.name}
              color = {value.connected ? '#338433' : 'grey'}
              onPress = {() => this.connectToDevice(value.id)}
            />
            { this.renderCamButton(value) }
          </View>
        )}

      {this.state.bigBlackMask 
      ? <TouchableOpacity ref="black_mask_to_save_battery"
          style={{
            position:'absolute', backgroundColor:'black', top:0,bottom:0,left:0,right:0,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection:'row',
          }}
          onPress = {() => this.toggleBigBlackMask()}
        >
          <Text
            style={{
              color:this.state.battery.charging ? colors.greenFlash : 'grey', 
              fontSize:50,fontWeight:'bold'}}
            >
            {this.state.battery.level}%
          </Text>
          { this.state.battery.charging
            ? <MaterialCommunityIcons.Button 
                backgroundColor={'transparent'} 
                name='battery-charging'
                size={60}
                color={colors.greenFlash}
              />
            : <MaterialCommunityIcons.Button 
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

const
styles = StyleSheet.create({ 
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
});
