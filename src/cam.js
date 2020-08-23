import React, {Component} from 'react';
import { // Platform, 
  StyleSheet, Text, View,
  Dimensions,
  ScrollView,
  Button,
  TouchableOpacity ,
  Alert,
  Image,
  PermissionsAndroid,
  NativeModules,
  PixelRatio,
  // Slider,
  PanResponder,
  Animated,
  TextInput,
  // AsyncStorage,
  KeyboardAvoidingView,
} from 'react-native';

import AsyncStorage from '@react-native-community/async-storage';
import Slider from '@react-native-community/slider';
import RNFetchBlob from 'rn-fetch-blob';
import { RNCamera } from 'react-native-camera';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';
import Svg, { Ellipse,} from 'react-native-svg';
import ViewShot from "react-native-view-shot";

import { date2folderName } from './formatHelpers.js';
import { colors } from './colors';

let source;
let motionMask;

if (__DEV__) {
  const _source = resolveAssetSource(require('../img/bug.png'));
  const _motionMask = resolveAssetSource(require('../img/round_mask.png'));
  source = { uri: `${_source.uri}` };
  motionMask = { uri: `${_motionMask.uri}` };
}
else {
  source = {uri: 'asset:/img/bug.png'};
  motionMask = {uri: 'asset:/img/round_mask.png'};
}

const sliderHeight = 50;
const MODE_RUN = 0;
const MODE_OFF = -1;
const MODE_SET = 1;

const landmarkSize = 2;



    const previewWidth = Dimensions.get('window').width,
          previewHeight = Dimensions.get('window').width*4/3;




//----------------------------------------------------------------------------------------
class Draggable extends Component { // Motion mask handles
//----------------------------------------------------------------------------------------    
  constructor(props) {
    super(props);

    this.state = {
      pan: new Animated.ValueXY(),
      opacity: new Animated.Value(1)
    };

    this.pictureRequested = false;
    this.videoRequested = false;

    this.initialPos = props.initialPos ? props.initialPos : {x:0,y:0};

    this._val = { x:0, y:0 }

    this.state.pan.addListener((value) => {
      this._val = value;
      // Frame adjustment callback.
      this.props.onMove({
        x:value.x+this.initialPos.x,
        y:value.y+this.initialPos.y,
      });
    });


    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (e, gesture) => true,
      onPanResponderGrant: (e, gesture) => {
        this.state.pan.setOffset(this._val)
        this.state.pan.setValue({ x:0, y:0})
      },
      onPanResponderMove: Animated.event([ 
        null, { dx: this.state.pan.x, dy: this.state.pan.y }
      ], 
      {
        listener: (event) => console.log(event), // Optional async listener
        useNativeDriver: false
      }
      ),
      onPanResponderRelease: (e, gesture) => {
        // Back to initial position if out of canvas.
        if (this._val.x + this.initialPos.x < HANDLE_RADIUS
        ||  this._val.y + this.initialPos.y < HANDLE_RADIUS
        ||  this._val.x + this.initialPos.x > this.props.previewWidth-HANDLE_RADIUS
        ||  this._val.y + this.initialPos.y > this.props.previewHeight-HANDLE_RADIUS
        ) {
          Animated.spring(this.state.pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      }
    });
  }

  render() {
    const panStyle = {
      transform: this.state.pan.getTranslateTransform()
    }
    return (
      <View >
      <View style={{ position: "absolute", 
        left: this.initialPos.x-HANDLE_RADIUS , 
        top:this.initialPos.y-HANDLE_RADIUS }}>
        <Animated.View
          {...this.panResponder.panHandlers}
          style={[panStyle, styles.handle]}
        />
      </View>
      </View>
    );
  }
}











//----------------------------------------------------------------------------------------
class MotionSetupButtons extends Component { // Motion mask handles
//----------------------------------------------------------------------------------------    
  constructor(props) {
    super(props);

    this.state = {
      motionSetupActiveButton:false, // to know wich panel/slider is open.
    };

    this.renderMotionSetupTodoFormHeight=300;
  }


  toggleMotionSetup(val){
    if(this.state.motionSetupActiveButton && this.state.motionSetupActiveButton.indexOf(val) != -1){ 
                          // watch out threshold / threshold-rvb
      this.setState({
        motionSetupActiveButton:false,
      });
    }
    else{
      this.setState({
        motionSetupActiveButton:val,
      }); 
    }
  }

  toggleMotionAction(type){
    this.props.storeMotionSettings({motionAction:{
      ...this.props.motionAction,
      type:type,
    }});

    // this.setState({motionAction:{
    //   ...this.props.motionAction,
    //   type:type,
    // }},function(){this.storeMotionSettings()}
    // );
  } 

  setMotionActionValue(key, val){
    if(isNaN(val)){
      val = 1;
    }
    else if(val<1) {
      val = 1;
    }
    else if (val>60){
      sec = 60;
    }
    this.props.storeMotionSettings({motionAction:{
      ...this.props.motionAction,
      [key]:val,
    }});
  }

  toggleShape(){
    this.props.storeMotionSettings({ 
      motionInputAreaShape: this.props.motionInputAreaShape == ''
                            ? 'elipse'
                            : this.props.motionInputAreaShape == 'elipse'
                              ? 'rectangle'
                              : ''
    });
  }

  onThreshold(mask, color){
    const threshold = this.props.threshold & ~mask | color;
    this.props.storeMotionSettings({'threshold':threshold});
  }

  onMinimumPixels(minimumPixels){
    this.props.storeMotionSettings({'minimumPixels':minimumPixels});
    // this.setState({minimumPixels:minimumPixels}, function(){this.storeMotionSettings({'minimumPixels':minimumPixels})});
  }

  onSampleSize(sampleSize){
    let minimumPixels = this.props.minimumPixels;
    if(minimumPixels > previewHeight/sampleSize){
      minimumPixels = parseInt(previewHeight/sampleSize);
    }
    this.props.storeMotionSettings({
      sampleSize:sampleSize,
      minimumPixels:minimumPixels,
    });
  }


  renderMotionSetupItems(slider){
    return(
      <View 
        style={{
          position:'absolute', left:0, right:0, top:0, 
          backgroundColor:'rgba(0,0,0,0.5)',
          marginTop: 
            this.state.motionSetupActiveButton=='action' 
            || (!this.props.motionAction.type || (!this.props.motionAction.photoNumber && !this.props.motionAction.videoLength))
            ? -this.renderMotionSetupTodoFormHeight
            : this.state.motionSetupActiveButton=='minimumPixels' 
              ? -sliderHeight-30
              : this.state.motionSetupActiveButton=='threshold-rvb' 
                ? -sliderHeight*3
                : -sliderHeight
        }}
        >
        <KeyboardAvoidingView behavior="padding">

        { this.state.motionSetupActiveButton == 'sampleSize'
        ? <Slider  
            ref="sampleSize"
            style={styles.slider} 
            thumbTintColor = '#ffffff' 
            minimumTrackTintColor='#dddddd' 
            maximumTrackTintColor='#ffffff' 
            minimumValue={-parseInt(previewWidth/10,10)}
            maximumValue={-1}
            step={1}
            value={-this.props.sampleSize}
            onValueChange={
              (value) => this.onSampleSize(-value)
            } 
          />

        : this.state.motionSetupActiveButton == 'threshold'
        ? <Slider  
            ref="threshold"
            style={styles.slider} 
            thumbTintColor = '#ffffff' 
            minimumTrackTintColor='#dddddd' 
            maximumTrackTintColor='#ffffff' 
            minimumValue={-255}
            maximumValue={0}
            step={1}
            // value={this.props.threshold}
            value={
              -(
                (this.props.threshold>>>16) 
              + ((this.props.threshold&0x00ff00)>>>8)
              + (this.props.threshold&0x0000ff)
              )/3
            }
            onValueChange={(value) => this.onThreshold(0xffffff, (-value<<16)|(-value<<8)|-value)} 
          />

        : this.state.motionSetupActiveButton == 'threshold-rvb'
        ? <React.Fragment>
            <Slider  
              ref="threshold_red"
              style={styles.slider} 
              thumbTintColor = '#d00' 
              minimumTrackTintColor='#dd0000' 
              maximumTrackTintColor='#dd0000' 
              minimumValue={-255}
              maximumValue={0}
              step={1}
              value={-(this.props.threshold>>>16)}
              onValueChange={(value) => this.onThreshold(0xff0000, -value<<16)} 
            />
            <Slider  
              ref="threshold_green"
              style={styles.slider} 
              thumbTintColor = {colors.greenFlash}
              minimumTrackTintColor={colors.greenFlash}
              maximumTrackTintColor={colors.greenFlash}
              minimumValue={-255}
              maximumValue={0}
              step={1}
              value={-((this.props.threshold & 0x00ff00) >>> 8)}
              onValueChange={(value) => this.onThreshold(0x00ff00,-value<<8)} 
            />
            <Slider  
              ref="threshold_blue"
              style={styles.slider} 
              thumbTintColor = '#0000dd' 
              minimumTrackTintColor='#0000dd' 
              maximumTrackTintColor='#0000dd' 
              minimumValue={-255}
              maximumValue={0}
              step={1}
              value={-(this.props.threshold & 0x0000ff)}
              onValueChange={(value) => this.onThreshold(0x0000ff,-value)} 
            />
            </React.Fragment>

          : this.state.motionSetupActiveButton == 'minimumPixels'
          ? <React.Fragment>
            <Text 
              style={{
                height:30,
                paddingTop:10,
                color:'#ffffff', 
                // backgroundColor:'rgba(0, 0, 0, 0.4)',//this.props.motionInputAreaShape ? 'transparent' : 'rgba(0, 0, 0, 0.4)'
                fontSize:16,
                textAlign:'center',
              }}
            >{this.props.minimumPixels-1} pixel{this.props.minimumPixels-1>1 ? 's':''}</Text>
            <Slider  
              ref="minimumPixels"
              style={styles.slider} 
              thumbTintColor = '#ffffff' 
              minimumTrackTintColor='#dddddd' 
              maximumTrackTintColor='#ffffff' 
              minimumValue={1}
              maximumValue={Math.min(98,parseInt(previewWidth/this.props.sampleSize,10))} 
              step={1}
              value={this.props.minimumPixels}
              onValueChange={(value) => this.onMinimumPixels(value)} 
            />
            </React.Fragment>

          : this.state.motionSetupActiveButton=='action' || (!this.props.motionAction.type || (!this.props.motionAction.photoNumber && !this.props.motionAction.videoLength))
          ? this.renderMotionSetupTodoForm()
          : null
        }

      </KeyboardAvoidingView>
      </View>
    );
  }

  renderMotionSetupTodoForm(){
    return(
      <View style={{height:this.renderMotionSetupTodoFormHeight, padding:10, backgroundColor: '#fafaff',}}>
        {/*<Text style={{padding:10, fontSize:16, textAlign:'center', color:colors.greenFlash,}}>Lorsqu'un mouvement est détecté</Text>*/}
        <Text style={{paddingTop:10, fontSize:18, fontWeight: 'bold', textAlign:'center', color:colors.greenFlash,}}>
          Action en cas de mouvement
        </Text>

        <View style={[styles.row, {justifyContent: 'space-between',flex:1, marginTop:5}]}>

          <View style={{flex:0.5}}>
            { this.props.motionAction.type == 'photo' 
              ? <View 
                  style={{
                    flexDirection:'row', 
                    flex:1, 
                    justifyContent:'center',
                    flexWrap: 'wrap', 
                    alignItems: 'flex-start',
                  }}>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  une </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  série </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  de </Text>
                <TextInput
                  keyboardType="number-pad"
                  //autoFocus={true}
                  textAlign={'center'}
                  style={{backgroundColor:'white', width:30, height:30, borderWidth:1, borderColor:colors.greenDark, padding:0, margin:0}}
                  defaultValue={''+this.props.motionAction.photoNumber}
                  onEndEditing =    {(event) => this.setMotionActionValue('photoNumber', parseInt(event.nativeEvent.text,10)) } 
                  onSubmitEditing = {(event) => this.setMotionActionValue('photoNumber', parseInt(event.nativeEvent.text,10)) } 
                />
                <Text style={[{fontSize:18, color: colors.greenFlash}]}> photo{this.props.motionAction.photoNumber>1?'s':''}.</Text>
                </View>

              : <TouchableOpacity onPress = {() => this.toggleMotionAction('photo')}>
                  <Text style={[{fontSize:18, padding:10, textAlign: 'center',
                    color: this.props.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre une série de photos</Text>
                </TouchableOpacity>
            }
          </View>

          <View style={[{flex:0.5}]}>
            { this.props.motionAction.type == 'video' 
              ? <View 
                  style={{
                    flexDirection:'row', 
                    flex:1, 
                    justifyContent:'center',
                    flexWrap: 'wrap', 
                    alignItems: 'flex-start',
                  }}>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  une </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  vidéo </Text>
                  <Text style={[{fontSize:18, color: this.props.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  de </Text>
                  <TextInput
                    keyboardType="number-pad"
                    // autoFocus={true}
                    textAlign={'center'}
                    style={{backgroundColor:'white', width:30, height:30, borderWidth:1, borderColor:colors.greenDark, padding:0, margin:0}}
                    defaultValue={''+this.props.motionAction.videoLength}
                    onEndEditing =    {(event) => this.setMotionActionValue('videoLength', parseInt(event.nativeEvent.text,10)) } 
                    onSubmitEditing = {(event) => this.setMotionActionValue('videoLength', parseInt(event.nativeEvent.text,10)) } 
                  />
                  <Text style={{fontSize:18, color: colors.greenFlash}}> seconde{this.props.motionAction.videoLength>1?'s':''}.</Text>
                </View>

              : <TouchableOpacity onPress = {() => this.toggleMotionAction('video')}>
                  <Text style={{fontSize:18, textAlign:'center', padding:10,
                    color: this.props.motionAction.type=='video' ? colors.greenFlash : colors.greenDark
                  }}>
                  Prendre une vidéo</Text>
                </TouchableOpacity>

              // TODO: Send alert to connected device ?

            }
          </View>
        </View>        
      </View>
    );
  }

  render(){   
    // console.log('render MotionSetupButtons', this.props)
    return(  
      <View 
        style={{flex: 1, justifyContent:'space-between', height:120}}
        >

        { this.renderMotionSetupItems() }

        <View></View>

        <ScrollView
          style={{paddingTop:5, paddingBottom:5}}
          horizontal={true}
          >

          <TouchableOpacity 
            style={{
              // borderRightWidth:1, borderRightColor:'#dddddd',
              alignItems: 'center', justifyContent:'center',
              paddingLeft:10, paddingRight:10,
            }}
            onPress = {() => this.toggleMotionSetup('action')}
            >
            <MaterialCommunityIcons   
              // Action
              borderRadius={0}
              name='gesture-double-tap' //   th-large      
              size={25}
              paddingLeft={10}
              color= {colors.greenFlash}
              backgroundColor ={'transparent'}
            />
            <Text 
              style={{fontSize:14, padding:0, margin:0, /*marginLeft:-5, marginRight:-7, paddingRight:7,*/ 
                
                color:
                  this.state.motionSetupActiveButton=='action' || (!this.props.motionAction.type || (!this.props.motionAction.photoNumber && !this.props.motionAction.videoLength)) 
                  ? colors.greenFlash 
                  : 'grey' 
              }}
              >Action</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              // borderRightWidth:1, borderRightColor:'#dddddd',
              alignItems: 'center', justifyContent:'center',
              paddingLeft:10, paddingRight:10,
            }}
            onPress = {() => this.toggleShape()}
            >
            <MaterialCommunityIcons   
              // Mask
              borderRadius={0} 
              name='image-filter-center-focus-weak' //   select-all // selection-ellipse     
              size={25}
              color= {colors.greenFlash}
              backgroundColor ={'transparent'}
            />
            <Text 
              style={{fontSize:14, padding:0, margin:0, /*marginLeft:-5, marginRight:-7, paddingRight:7,*/
                color:this.props.motionInputAreaShape ? colors.greenFlash : 'grey' ,}}
              >Masque</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              // borderRightWidth:1, borderRightColor:'#dddddd',
              alignItems: 'center', justifyContent:'center',
              paddingLeft:10, paddingRight:10,
            }}
            onPress = {() => this.toggleMotionSetup('sampleSize')}
          >
            <MaterialCommunityIcons
              // Précision
              borderRadius={0} 
              name='blur' //      grid // view-grid //view-comfy
              size={25}
              color= {colors.greenFlash}
              backgroundColor ={'transparent'}
            />
            <Text 
              style={{fontSize:14, padding:0, margin:0, /*marginLeft:-5, marginRight:-7, paddingRight:7,*/
              color:this.state.motionSetupActiveButton=='sampleSize' ? colors.greenFlash : 'grey' ,}}
              >Précision</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              // borderRightWidth:1, borderRightColor:'#dddddd',
              alignItems: 'center', justifyContent:'center',
              paddingLeft:10, paddingRight:10,
            }}
            onPress = {() => this.toggleMotionSetup('threshold')}
            onLongPress = {() => this.toggleMotionSetup('threshold-rvb')}
            >
            <MaterialCommunityIcons   
              // Sensibilité
              borderRadius={0} 
              name='contrast-circle' //   contrast-box     
              size={25}
              color= {colors.greenFlash}
              backgroundColor ={'transparent'}
            />
            <Text 
              style={{fontSize:14, padding:0, margin:0, /*marginLeft:-5, marginRight:-7, paddingRight:7,*/
              color:this.state.motionSetupActiveButton && this.state.motionSetupActiveButton.indexOf('threshold') != -1 
                ? colors.greenFlash : 'grey' ,}}
              >Sensibilité</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{
              // borderRightWidth:1, borderRightColor:'#dddddd',
              alignItems: 'center', justifyContent:'center',
              paddingLeft:10, paddingRight:10,
            }}
            onPress = {() => this.toggleMotionSetup('minimumPixels')}
            >
            <MaterialCommunityIcons   
              // Bruit
              borderRadius={0}
              name='eraser'   
              size={25}
              color= {colors.greenFlash}
              backgroundColor ={'transparent'}
            />
            <Text 
              style={{fontSize:14, padding:0, margin:0,  /*marginLeft:-5, marginRight:-7, paddingRight:7,*/
              color:this.state.motionSetupActiveButton=='minimumPixels' ? colors.greenFlash : 'grey' ,}}
              >Antibruit</Text>
          </TouchableOpacity>
        </ScrollView>
      
        <View></View>

        { // Do not show Launch / Close buttons if we open cam to setup motion detector.
        this.props.mode == MODE_SET
        ? null
        : <View 
            style={{ 
            flexDirection:'row', 
            backgroundColor:colors.greenFlash}}
            >
            <TouchableOpacity 
              onPress = {() => this.props.closeSetupMotion()}
              style={{padding:10, 
                flex:this.props.motionAction.type && (this.props.motionAction.photoNumber || this.props.motionAction.videoLength)?0.5:1,
                flexDirection:'row',
                justifyContent:'center',
                borderRightColor:'white', borderRightWidth:1,
              }}>
              <MaterialCommunityIcons   
                name='close'
                size={30}
                padding={0}
                margin={0}
                color='white'
              />
              <Text style={{marginLeft:10, fontWeight:'bold', color:'white', fontSize: 18 }}>
              Fermer</Text>
            </TouchableOpacity>

            { this.props.motionAction.type && (this.props.motionAction.photoNumber || this.props.motionAction.videoLength)
              ? <TouchableOpacity 
                onPress = {() => this.props.takeMotion()}
                style={{padding:10, 
                  flex:0.5,
                  flexDirection:'row',
                  justifyContent:'center',
                }}>
                <MaterialCommunityIcons
                  style={{
                    borderRadius:30,
                    backgroundColor:'white'}}
                  name='cctv'
                  size={30}
                  color ={colors.greenFlash}
                />
                <Text style={{marginLeft:10, fontWeight:'bold', color:'white', fontSize: 18 }}>
                Lancer</Text>
              </TouchableOpacity>
              : null
            }
          </View>
        }
      </View>
    );
  }

}









//----------------------------------------------------------------------------------------
class ActionButtons extends Component {
//----------------------------------------------------------------------------------------    
  constructor(props) {
    super(props);
    this.state = {};
    this.stopRecordRequested = false;
  }

  render(){   
    return (
      <View 
        key="ActionButtons" 
        style={[
          styles.iconButtonContainer,
          { width: previewWidth, height:120,},
        ]} 
        >
        <View style={styles.iconButton}>
        <MaterialCommunityIcons.Button   
          name='camera'
          underlayColor={'white'}
          size={40}
          width={100}
          margin={0}
          paddingLeft={30}
          color= { this.props.isTakingPicture ? colors.purple : colors.greenFlash}
          backgroundColor ={'transparent'}
          // onPress = {() =>{}}
          onPress = {() => this.props.takePicture()}
        /></View>

        { this.props.cam.indexOf('collection-') < 0
          ?
          <React.Fragment>
          <View style={styles.iconButton}>
          <MaterialCommunityIcons.Button   
            name='video'
            underlayColor={'white'}
            size={40}
            width={100}
            margin={0}
            paddingLeft={30}
            color= { this.props.isRecording ? colors.purple : colors.greenFlash}
            backgroundColor ={'transparent'}

            onPress={
              this.props.isRecording 
              ? () => {
                  this.stopRecordRequested = true;
                  this.props.stopRecording();
                }
              : () => this.props.takeVideo()
            }
          /></View>

          <View style={styles.iconButton}>
          <MaterialCommunityIcons.Button   
            name='cctv'
            underlayColor={'white'}
            size={40}
            width={100}
            margin={0}
            paddingLeft={30}
            paddingBottom={12}
            color= {this.props.motionDetectionMode==MODE_RUN ? colors.purple : colors.greenFlash }
            backgroundColor ={'transparent'}
            onPress = {() => this.props.onMotionButton()}
          /></View>
           
          { this.props.motionsCount
            ? <Text style={{
                marginTop:-40, marginLeft:-30, textAlign:'center',
                height:20,width:20, backgroundColor:colors.purple, borderRadius:20,
                color:'white', fontSize:12, fontWeight:'bold',
                }}>
                {this.props.motionsCount}</Text>
            : null
          }
              
          </React.Fragment>
          :null
        }
      </View>
    );
    
  }
}













//=========================================================================================
//-----------------------------------------------------------------------------------------
export default class Cam extends Component<Props> {
//-----------------------------------------------------------------------------------------
//=========================================================================================
  constructor(props) {
    super(props);
    this.state = {
      cam: props.mode ? props.mode : 'collection-form', // Different reasons why cam is on:
        // 'free'
        // collection-form
        // 'collection-flower'
        // 'collection-environment'
        // 'session' ( = free while session running)
        // 'motion-setup' (while setting motion parameters)
        // 'motion-running' (while session running) 
      // TODO: ? re-think views vs cam state to switch to form etc..

      faces:[],

      // Pure layout needs.
      isRecording:false,
      isTakingPicture:false,
        // on/off motion setup icons states.
      motionsCount:0,

      motionDetected:false,
      motionBase64:'',
    
      // Locally stored, re-initialised on componentWillMount().
       
      // motionOutputRunning:'',
      motionDetectionMode: MODE_OFF,

      motionsetup:{
        zoom:0,
        threshold : 0xa0a0a0,
        sampleSize : 30,
        minimumPixels: 1,
        motionInputAreaShape:'',
        motionInputAreaStyle:{
          top: 60,
          left: 60,
          width: Dimensions.get('window').width - 60 - 60,
          height: Dimensions.get('window').width*4/3 - 60 - 60,
        },
        motionAction:{
          type:false,
          photoNumber:'',
          videoLength:'',
        },
      },

    };
    this.handles = [{
      x:60,
      y:60,
    },{
      x: Dimensions.get('window').width - 60, 
      y: Dimensions.get('window').width*4/3 - 60,
    }];


    this.motionActionRunning=false;
    this.motionPhotoNumber=false;
    this.motionActionVideo=false;
  }

  componentDidMount() {

    // Get stored parameters.
    AsyncStorage.getItem('motion_parameters', (err, motion_parameters) => {
      if (err) {
        // Alert.alert('ERROR getting locations'+ JSON.stringify(err));
      }
      else {
        if(motion_parameters){
          motion_parameters = JSON.parse(motion_parameters);

          // console.log('<Cam> DidMount, motion_parameters',motion_parameters)

          this.setState({motionsetup:{
            motionAction:{
              zoom: motion_parameters.zoom ? motion_parameters.zoom : 0,
              type: motion_parameters.motionAction.type ? motion_parameters.motionAction.type : false,
              videoLength:motion_parameters.motionAction.videoLength ? motion_parameters.motionAction.videoLength : '',
              photoNumber:motion_parameters.motionAction.photoNumber ? motion_parameters.motionAction.photoNumber : '',
            },
            // motionOutputRunning:motion_parameters.motionOutputRunning ? motion_parameters.motionOutputRunning : '',
            // motionDetectionMode:motion_parameters.motionDetectionMode ? motion_parameters.motionDetectionMode : MODE_OFF,
            threshold :motion_parameters.threshold ? motion_parameters.threshold :  0xa0a0a0,
            sampleSize :motion_parameters.sampleSize ? motion_parameters.sampleSize :  30,
            minimumPixels:motion_parameters.minimumPixels ? motion_parameters.minimumPixels :  1,
            motionInputAreaShape:motion_parameters.motionInputAreaShape ? motion_parameters.motionInputAreaShape : '',
            motionInputAreaStyle:{
                top: motion_parameters.motionInputAreaStyle&&motion_parameters.motionInputAreaStyle.top ? motion_parameters.motionInputAreaStyle.top : 60,
                left: motion_parameters.motionInputAreaStyle&&motion_parameters.motionInputAreaStyle.left ? motion_parameters.motionInputAreaStyle.left : 60,
                width: motion_parameters.motionInputAreaStyle&&motion_parameters.motionInputAreaStyle.width ? motion_parameters.motionInputAreaStyle.width : Dimensions.get('window').width - 60 - 60,
                height: motion_parameters.motionInputAreaStyle&&motion_parameters.motionInputAreaStyle.height ? motion_parameters.motionInputAreaStyle.height : Dimensions.get('window').width*4/3 - 60 - 60,
              },
          }}, function(){

            this.handles = [{
              x:this.state.motionsetup.motionInputAreaStyle.left,
              y:this.state.motionsetup.motionInputAreaStyle.top,
            },{
              x: this.state.motionsetup.motionInputAreaStyle.left+this.state.motionsetup.motionInputAreaStyle.width,
              y: this.state.motionsetup.motionInputAreaStyle.top+this.state.motionsetup.motionInputAreaStyle.height,
            }];
          });
        }
        else {
          // default here
        }
      }
    });
  }

  onCameraReady = async () => {
    // const getAvailablePictureSizes = await this.camera.getAvailablePictureSizes('4:3');
    // console.log(getAvailablePictureSizes);
    // const getSupportedRatiosAsync = await this.camera.getSupportedRatiosAsync();
    // console.log(getSupportedRatiosAsync);
    // const getPreviewSize = await this.camera.getPreviewSize();
    // console.log(getPreviewSize);
  }

                onFacesDetected = ({ faces }) => {
                       console.log('FACE');
                      console.log(faces);
                      this.setState({ faces:faces });
                    };

                    onFaceDetectionError = state => console.warn('Faces detection error:', state);

                    renderFace({ bounds, faceID, rollAngle, yawAngle }) {
                      return (
                        <View
                          key={faceID}
                          transform={[
                            { perspective: 600 },
                            { rotateZ: `${rollAngle.toFixed(0)}deg` },
                            { rotateY: `${yawAngle.toFixed(0)}deg` },
                          ]}
                          style={[
                            styles.face,
                            {
                              ...bounds.size,
                              left: bounds.origin.x,
                              top: bounds.origin.y,
                            },
                          ]}
                        >
                          {/*
                          <Text style={styles.faceText}>ID: {faceID}</Text>
                          <Text style={styles.faceText}>rollAngle: {rollAngle.toFixed(0)}</Text>
                          <Text style={styles.faceText}>yawAngle: {yawAngle.toFixed(0)}</Text>
                          */}
                        </View>
                      );
                    }

                    renderFaces() {
                      return (
                        <View style={styles.facesContainer} pointerEvents="none">
                          {this.state.faces.map(this.renderFace)}
                        </View>
                      );
                    }

  onMotionDetected = ({ motion }) => {
    // console.log('MOTION', motion);

    this.setState({
      motionDetected:motion.motionDetected,
      motionBase64: motion.motionBase64,
    }, function(){
      //
    });  

    if(this.motionActionRunning){
      return;
    }

    if (motion.motionDetected
    && this.state.motionDetectionMode==MODE_RUN  // runningmode
    // && this.state.cam != 'motion-running'
    ){
      this.motionActionRunning = true;
      this.setState({motionsCount: this.state.motionsCount+1});
      if(!this.motionActionVideo && this.state.motionsetup.motionAction.type=='video'){
        this.motionActionVideo = true;
        this.takeVideo();
      }
      else if(!this.motionPhotoNumber && this.state.motionsetup.motionAction.type=='photo'){
        this.motionPhotoNumber = 1;
        this.takePicture();
      }
    }
  }

  takePicture = async () => {
    // console.log('takePicture ' + this.motionPhotoNumber);

    if (this.camera) {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE]);

        if (granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        &&  granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED){

          const options = { 
            quality: 0.9,
            fixOrientation: true,
          }

          if(this.pictureRequested){
            options.base64 = true;
          }
          else{
            options.skipProcessing = true;
          }
          try {
            this.setState({ isTakingPicture: true }); 
            var picture = await this.camera.takePictureAsync(options);
             console.log('picture',picture);
                  // width: returns the image's width (taking image orientation into account)
                  // height: returns the image's height (taking image orientation into account)
              // uri: (string) the path to the image saved on your app's cache directory.
              // base64: (string?) the base64 representation of the image if required.
              // exif: returns an exif map of the image if required.
              // pictureOrientation: (number) the orientation of the picture
              // deviceOrientation: (number) the orientation of the device


            const filename = 
              (this.props.path || RNFetchBlob.fs.dirs.DCIMDir)
              + '/' 
              + date2folderName()
              + '.jpg'
            ;
            //console.log('dest',filename);

            RNFetchBlob.fs.mv(
              picture.uri.replace('file://',''),
              filename
            ).then(() => {

              this.props.onPictureTaken({ ...picture, uri:'file://' + filename });
              this.setState({ isTakingPicture: false });

              // Go on according to requested motion-action.
              console.log(this.motionPhotoNumber + ' ' +this.state.motionsetup.motionAction.photoNumber);
              if (this.motionPhotoNumber){
                if(this.motionPhotoNumber < this.state.motionsetup.motionAction.photoNumber){
                  this.motionPhotoNumber++;
                  this.takePicture();
                }
                else{
                  this.motionActionRunning = false;
                  this.motionPhotoNumber = false;
                }
              }              
              
              // Send photo to distant device.
              if(this.pictureRequested){
                this.props.onRequestedPictureTaken(this.pictureRequested, picture.base64);
                this.pictureRequested = false;
              }

              // Send photo back to form.

              // if (this.props.trigger=='collection')){
                if(this.props.photoPicked) this.props.photoPicked(filename);
                // const collId =  this.state.cam.split('--')[1];
                // const field =  this.state.cam.split('--')[2];
                // this.setState({
                //   cam:'collection-form',
                // }, function(){
                //   this.refs['collectionList']
                //       .refs['collections']
                //       .refs['collection']
                //       .refs['collection-form']
                //       .refs['collection-'+field]
                //       .setSource({uri:'file://' + this.state.storage + '/' + filename});
                // })
              // }
            }).catch((err) => { 
              this.setState({ isTakingPicture: false }); 
              console.log(err) 
            });
          } 
          catch (err) {
            console.log('takePictureAsync ERROR: ', err);
          }
        } else {
         alert('REFUSED');
        }
      } catch (err) {
        // console.warn(err)
      }
    }
  }


  async takeVideo() {

    /*
    https://github.com/react-native-community/react-native-camera/blob/master/docs/RNCamera.md#recordasyncoptions-promise

Type  Video Bitrate, Standard Frame Rate (24, 25, 30) Video Bitrate, High Frame Rate (48, 50, 60)
2160p (4k)  35-45 Mbps  53-68 Mbps
1440p (2k)  16 Mbps 24 Mbps
1080p 8 Mbps  12 Mbps
720p  5 Mbps  7.5 Mbps
    */
    if (this.camera) {
      try {

        const filename = 
          (this.props.path || RNFetchBlob.fs.dirs.DCIMDir)
          + '/' 
          + date2folderName()
          + '.mp4'

        const promise = this.camera.recordAsync({
          path: filename,
          maxDuration: this.motionActionVideo ? this.state.motionsetup.motionAction.videoLength : 60, // TODO param 60
//orientation:"landscapeLeft"
          // quality // RNCamera.Constants.VideoQuality.2160p  ...
          // videoBitrate // 5*1000*1000 would be 5Mbps.
          //orientation "portrait", "portraitUpsideDown", "landscapeLeft" or "landscapeRight".
        });

        if (promise) {
          // uri: (string) the path to the video saved on your app's cache directory.
          // videoOrientation: (number) orientation of the video
          // deviceOrientation: (number) orientation of the device
          // isRecordingInterrupted: (boolean) whether the app has been minimized while recording

          if(this.props.recording){
            this.props.recording(true);
          }
          this.setState({ isRecording: true });

          const data = await promise;
          //console.log('video promise',data)

          // Store video thumb.
          NativeModules.RNioPan.getVideoThumb(filename)
          .then((result) => {
            // path", "file://" + fullPath + '/' + fileName);
            // width
            // height

            if(this.videoRequested){

              NativeModules.RNioPan.JPEGtoBase64(result.path.replace('file://',''))
              .then((base64) => {
                this.props.onRequestedPictureTaken(this.videoRequested, base64);
                this.videoRequested = false;
              })
              .catch((err) => { 
                this.videoRequested = false;
                alert('ERROR JPEGtoBase64');
              });
             
            }
            else {
              this.props.onPictureTaken({
                ...data,
                uri:result.path,
                width:result.width,
                height:result.height,
              });
            }

            // console.log('thumb',result);
          }).catch((err) => { 
              alert('ERROR getVideoThumb ' + filename);
          });
          ;

          if (this.refs.ActionButtons.stopRecordRequested || this.motionActionVideo) {
            this.motionActionRunning = false;
            this.motionActionVideo = false;
            if(this.props.recording){
              this.props.recording(false);
            }
            this.setState({isRecording: false});
          }
          else {
            this.takeVideo();
          }


        }
      }
      catch (err) {
        console.log(err);
        alert(JSON.stringify({'recording error':err}, undefined, 2));
        this.setState({isRecording:false});
     // TODO:   this.sendMessage(this.state.connectedTo, 'distantRec', false);
      }
    }
  };


  onMotionButton(){
    if(this.state.motionDetectionMode!=MODE_OFF){
      this.setState({
        motionDetectionMode:MODE_OFF,
        motionsCount:0,
      });
    }
    else{
      this.setState({
        cam:'motion-setup',
        motionDetectionMode:MODE_SET
      });
    }
  }

  takeMotion(){
    this.setState({
      cam:'free',
      motionDetectionMode:MODE_RUN
    });
  }

  closeSetupMotion(){
    this.setState({
      cam:'free',
      motionDetectionMode: MODE_OFF,
    }); 
  }

  renderMotion(){
    if (this.state.motionDetectionMode == MODE_OFF)
      return null;

    return (
      <React.Fragment>
        { this.state.motionBase64
          ? <Image
              pointerEvents="none"
              style={styles.MotionContainer} 
              fadeDuration={0}
              style = {[styles.motionpreview,{/*width:previewWidth, height:previewHeight*/}]}
              source={{uri: 'data:image/png;base64,' + this.state.motionBase64}}
            />
          : null
        }

        { this.state.motionsetup.motionInputAreaShape
          ? <View style={styles.MotionContainer}>
              { this.state.motionsetup.motionInputAreaShape=='elipse'
                ? <Image 
                    pointerEvents="none"
                    fadeDuration={0}
                    pointerEvents="none"
                    source = {motionMask}
                    resizeMode="stretch"
                    style={[
                      this.state.motionsetup.motionInputAreaStyle,{
                      borderWidth:2, 
                      borderColor:'transparent', 
                      position:'absolute', 
                      opacity:0.4,
                    }]}
                  />
                : null
              }

              <View 
                pointerEvents="none"
                style={[
                  this.state.motionsetup.motionInputAreaStyle,{
                  borderWidth:1, 
                  borderColor: this.state.motionInputAreaShape=='elipse' ?  colors.greenDark : colors.greenFlash, 
                  position:'absolute'
                }]}
              />

              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  top:0,
                  left:0,
                  right:0,
                  height:this.state.motionsetup.motionInputAreaStyle.top,
                } ]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  left:0,
                  right:0,
                  top: this.state.motionsetup.motionInputAreaStyle.top+this.state.motionsetup.motionInputAreaStyle.height,
                  bottom:0,
                } ]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  top:this.state.motionsetup.motionInputAreaStyle.top,
                  left:0,
                  width: this.state.motionsetup.motionInputAreaStyle.left,
                  height: this.state.motionsetup.motionInputAreaStyle.height,
                }]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  top:this.state.motionsetup.motionInputAreaStyle.top,
                  right:0,
                  left: this.state.motionsetup.motionInputAreaStyle.left + this.state.motionsetup.motionInputAreaStyle.width,
                  height: this.state.motionsetup.motionInputAreaStyle.height,
                }]}
              />     

              { this.state.motionsetup.motionInputAreaShape=='elipse'
                ? <Svg 
                    pointerEvents="none"
                    style={[
                      styles.motionInputArea, 
                      this.state.motionsetup.motionInputAreaStyle, 
                      {borderWidth:2, borderColor:'transparent'}
                    ]}
                    height={this.state.motionsetup.motionInputAreaStyle.height}
                    width={this.state.motionsetup.motionInputAreaStyle.width}
                    >
                    <Ellipse
                      cx={this.state.motionsetup.motionInputAreaStyle.width/2}
                      cy={this.state.motionsetup.motionInputAreaStyle.height/2}
                      rx={this.state.motionsetup.motionInputAreaStyle.width/2 - 1}
                      ry={this.state.motionsetup.motionInputAreaStyle.height/2 - 1}
                      stroke={colors.greenFlash}
                      strokeWidth="2"
                      fill="transparent"
                    />
                  </Svg>
                : null
              }

              { this.state.motionDetectionMode == MODE_SET
                ? <React.Fragment>
                  <Draggable 
                    onMove = {(value) => this.onMoveHandle( 0, value) }
                    initialPos = {{
                      x:this.state.motionsetup.motionInputAreaStyle.left, 
                      y:this.state.motionsetup.motionInputAreaStyle.top
                    }}
                    previewWidth = {previewWidth}
                    previewHeight = {previewHeight}
                  />
                  <Draggable
                    onMove = {(value) => this.onMoveHandle(1, value) }
                    initialPos = {{
                      x:this.state.motionsetup.motionInputAreaStyle.left+this.state.motionsetup.motionInputAreaStyle.width,
                      y:this.state.motionsetup.motionInputAreaStyle.top+this.state.motionsetup.motionInputAreaStyle.height
                    }}
                    previewWidth = {previewWidth}
                    previewHeight = {previewHeight}
                  />
                  </React.Fragment>
                : null
              }
            </View>
          : null
        }

      </React.Fragment>
    );
  }// renderMotion

  renderCamera() {
    // TODO:
    // if(this.state.connectedTo && this.camRequested){
    //   this.camRequested = false;
    //   this.sendMessage(this.state.connectedTo, 'distantcam', true);
    // }

    return (
      <ViewShot
        key="renderCamera"
        ref="viewShotCam"
        options={{
          result:"base64",
          format: "jpg", 
          quality:this.props.viewShotQuatity ? this.props.viewShotQuatity : 0.5 ,
        }}
      >
      <RNCamera
        // onLayout={(event) => this.onCamLayout( 
        //  event.nativeEvent.layout.width, event.nativeEvent.layout.height
        // )}
        ref={cam => (this.camera = cam)}
        style = {[styles.cam,{width:previewWidth, height:previewHeight}]}
        onCameraReady = {this.onCameraReady}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.off}
        ratio="4:3"
        autoFocus ={RNCamera.Constants.AutoFocus.on}
        zoom={this.state.zoom}

        motionDetectionMode={this.state.motionDetectionMode}
        onMotionDetected={this.onMotionDetected}
        
        motionDetectionMinimumPixels={this.state.motionsetup.minimumPixels}
        motionDetectionThreshold={this.state.motionsetup.threshold}
        motionDetectionSampleSize={this.state.motionsetup.sampleSize}
        motionDetectionArea={ 
          this.state.motionsetup.motionInputAreaShape == ''
          ? ""
          : this.state.motionsetup.motionInputAreaShape +";"+
            Math.ceil(this.state.motionsetup.motionInputAreaStyle.left/this.state.motionsetup.sampleSize) +";"+ 
            Math.ceil(this.state.motionsetup.motionInputAreaStyle.top /this.state.motionsetup.sampleSize) +";"+
            Math.floor(this.state.motionsetup.motionInputAreaStyle.width /this.state.motionsetup.sampleSize) +";"+
            Math.floor(this.state.motionsetup.motionInputAreaStyle.height /this.state.motionsetup.sampleSize) +";"
        }

        // onFacesDetected={this.onFacesDetected}
        // onFaceDetectionError={this.onFaceDetectionError}  
        // faceDetectionLandmarks={RNCamera.Constants.FaceDetection.Landmarks.all}
        // faceDetectionClassifications ={RNCamera.Constants.FaceDetection.Classifications.all}
        >
          <Slider  
            ref="zoom"
            style={[styles.slider,{marginRight:60}]} 
            thumbTintColor = {colors.greenFlash} 
            minimumTrackTintColor={colors.greenFlash} 
            maximumTrackTintColor={colors.greenFlash}
            minimumValue={0}
            maximumValue={1}
            step={0.1}
            value={this.state.zoom}
            onValueChange={(value) => this.onZoom(value)} 
          />

          { this.state.motionDetected && (this.state.cam=='motion-setup' || this.state.motionDetectionMode==MODE_RUN)
          ? <MaterialCommunityIcons
              style={{
                position:'absolute', top:0, right:0, padding:7, margin:5,
                backgroundColor:'rgba(0,0,0,0.5)',
                borderRadius:40,
              }}
              name='ladybug'
              size={40}
              margin={0}
              color= {colors.greenFlash}
            />
          : null
        }

        {this.renderMotion()}
        {/*this.renderFaces()*/}
       </RNCamera>
    
      </ViewShot>
    );
  }

  onZoom(value){
    this.setState({zoom:value});
  };

  onMoveHandle(id, value){
    this.handles[id]=value;


    this.setState({motionsetup:{
      ...this.state.motionsetup,
      motionInputAreaStyle:{
        top: Math.min(this.handles[0].y, this.handles[1].y),
        left: Math.min(this.handles[0].x, this.handles[1].x),
        width: Math.abs(this.handles[0].x - this.handles[1].x),
        height: Math.abs(this.handles[0].y - this.handles[1].y),
      }
    }}, function(){ 
      // this.handles = [{ 
      //   x: Math.min(this.handles[0].x,this.handles[1].x),
      //   y: Math.min(this.handles[0].y,this.handles[1].y),
      //   },{
      //   x: Math.max(this.handles[0].x,this.handles[1].x),
      //   y: Math.max(this.handles[0].y,this.handles[1].y),
      // }];
      this.storeMotionSettings('motionInputAreaStyle',this.state.motionsetup.motionInputAreaStyle);
    });
  }

  toggleView(view) {
    this.setState({cam:view});
  }

  // pickPhoto(field){
  //   // alert(collection_id + ' '+ field)
  //   this.setState({cam:'collection--' + field});
  // }

  // pickInsectPhoto(path, collection_id, session_id, insectKind_id, insect_id){
  //   // alert(collection_id + ' '+  session_id + ' '+  insectKind_id + ' '+  insect_id)
  //   this.setState({cam:'collection--' + path + '--' + collection_id +'--'+ session_id + '--'+  insectKind_id + '--'+  insect_id });
  // }

  render() {
    console.log(this.state.cam);
    return (
      <View style={styles.container}>

        { this.renderCamera() }

        { this.state.cam == 'motion-setup'
          ? <MotionSetupButtons
              ref="MotionSetupButtons"
             
              motionAction={this.state.motionsetup.motionAction}
              minimumPixels={this.state.motionsetup.minimumPixels}
              threshold={this.state.motionsetup.threshold}
              sampleSize={this.state.motionsetup.sampleSize}
              motionInputAreaShape={this.state.motionsetup.motionInputAreaShape}
              motionInputAreaStyle={this.state.motionsetup.motionInputAreaStyle}

              storeMotionSettings={(motionsettings) => this.storeMotionSettings(motionsettings)}
              closeSetupMotion={() => this.closeSetupMotion()}

              takeMotion={() => this.takeMotion()}
            /> 
          : <ActionButtons
              ref="ActionButtons"
              cam={this.state.cam}
              isRecording={this.state.isRecording}
              isTakingPicture={this.state.isTakingPicture}
              motionDetectionMode={this.state.motionDetectionMode}
              motionsCount={this.state.motionsCount}

              takePicture={()=> this.takePicture()}
              takeVideo={()=> this.takeVideo()}
              stopRecording={()=> this.camera.stopRecording()}
              onMotionButton={()=> this.onMotionButton()}
            /> 
        }

      {/* TODO: bigBlackMask button  */ }

      </View>
    );
  }

  storeMotionSettings(val){
    console.log('storeMotionSettings val', val);

    if(val.motionInputAreaShape && val.motionInputAreaShape == ''){
      this.handles = [{
        x:Math.min(this.handles[0].x, this.handles[1].x),
        y:Math.min(this.handles[0].y, this.handles[1].y),
      },{
        x:Math.max(this.handles[0].x, this.handles[1].x),
        y:Math.max(this.handles[0].y, this.handles[1].y),
      }];
    }

 
    this.setState({
      motionsetup:{
        ...this.state.motionsetup,
        ...val,
      }}, function(){
        console.log('storeMotionSettings updstate', this.state.motionsetup);
        AsyncStorage.setItem('motion_parameters', JSON.stringify(this.state.motionsetup));

      });
    }


}

const
HANDLE_RADIUS = 15,
styles = StyleSheet.create({ 
  container: {
    flex: 1,
    backgroundColor:colors.background,
  },
  
  motionInputArea:{
    position:'absolute',
  },
  motionInputAreaMask:{
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  handle: {
    backgroundColor:colors.greenFlash,
    width: HANDLE_RADIUS * 2,
    height: HANDLE_RADIUS * 2,
    // borderRadius: HANDLE_RADIUS,
    borderWidth: 1,
    borderColor:colors.greenDark,
  },

  container: {
    flex: 1,
    backgroundColor: '#fafaff' //'#F5FCFF',
  },

  header:{
    alignSelf: 'stretch',
    flexDirection:'row',
    left:0,
    right:0,
    backgroundColor:'transparent',
  },
  slider:{
    height:sliderHeight,
    // backgroundColor:'rgba(0, 0, 0, 0.4)',
  },

  containerPreview: {
    flex: 1,
    flexWrap:'wrap',
    // flexDirection:'row',
    // justifyContent: 'flex-end',
    alignItems: 'center',//'flex-end',
    backgroundColor: '#F5FCFF',
  },
  cam: {
    // position: 'relative',
    // margin:1,
  },

  captureLocalView:{
    // width: previewWidth, 
    // height: previewHeight,
    position:'relative',
    // opacity:0,
  },
  captureLocal:{
    position:'absolute',
    top:0,
    left:0,
    // width: previewWidth, 
    // height: previewHeight, 
    // transform: [{ rotate: '90deg'}],
    resizeMode: 'contain', //enum('cover', 'contain', 'stretch', 'repeat', 'center')
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'red',

  },
  capture:{
    // width: previewWidth, 
    // height: previewHeight, 
    transform: [{ rotate: '90deg'}],
    resizeMode: 'stretch', //enum('cover', 'contain', 'stretch', 'repeat', 'center')
    borderWidth: 1, borderColor: 'red'
  },

  motionpreview:{
    position:'absolute',
    top:0,
    left:0,
    right:0,
    bottom:0,
    resizeMode: 'contain', //enum('cover', 'contain', 'stretch', 'repeat', 'center')
    backgroundColor: 'transparent',
    // borderWidth: 1,
    // borderColor: 'transparent',
  },

  MotionContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
  },

  iconButtonContainer:{
 

    // backgroundColor:'rgba(100,100,100,0.5)',
    // position:'absolute',
    // bottom:20,


    padding:5,
    flexDirection:'row',
    // justifyContent: 'space-between',
    justifyContent: 'center',
    alignItems: 'center',
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

  row: {
    flexDirection: 'row',
  },


  facesContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
  },
  face: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 2,
    position: 'absolute',
    borderColor: '#FFD700',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  landmark: {
    width: landmarkSize,
    height: landmarkSize,
    position: 'absolute',
    backgroundColor: 'red',
  },
  faceText: {
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 10,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
  },
});
