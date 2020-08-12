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
// import ViewShot from "react-native-view-shot";

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
            friction: 5
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


//=========================================================================================
export default class Cam extends Component<Props> {
//-----------------------------------------------------------------------------------------
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

      // Pure layout needs.
      isRecording:false,
      isTakingPicture:false,
      motionSetup:false,  // on/off motion setup icons states.
      motionsCount:0,

      motionDetected:false,
      motionBase64:'',
    
      // Locally stored, re-initialised on componentWillMount().
      zoom:0,
      motionAction:{
        type:false,
        photoNumber:'',
        videoLength:'',
      },
      // motionOutputRunning:'',
      motionDetectionMode: props.mode_ ? props.mode_ :  MODE_OFF,
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
    };
    this.handles = [{
      x:60,
      y:60,
    },{
      x: Dimensions.get('window').width - 60, 
      y: Dimensions.get('window').width*4/3 - 60,
    }];



    this.previewWidth = Dimensions.get('window').width;
    this.previewHeight = Dimensions.get('window').width*4/3;
    

    this.camRequested = false;
    this.stopRecordRequested = false;
    // TODO: http protocole.
    // TODO: trusted devices.
    // this.safeIds = [
    //   '6b16c792365daa8b',  //  s6 
    //   'add41fbf38b95c65',  //  s9
    // ],

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
          this.setState({
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
          }, function(){


            this.handles = [{
              x:this.state.motionInputAreaStyle.left,
              y:this.state.motionInputAreaStyle.top,
            },{
              x: this.state.motionInputAreaStyle.left+this.state.motionInputAreaStyle.width,
              y: this.state.motionInputAreaStyle.top+this.state.motionInputAreaStyle.height,
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
      if(!this.motionActionVideo && this.state.motionAction.type=='video'){
        this.motionActionVideo = true;
        this.takeVideo();
      }
      else if(!this.motionPhotoNumber && this.state.motionAction.type=='photo'){
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
          
            //console.log('src', picture.uri.replace('file://',''));
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
              this.props.onPictureTaken('file://' + filename);
              this.setState({ isTakingPicture: false });

              
              // Go on according to requested motion-action.
              console.log(this.motionPhotoNumber + ' ' +this.state.motionAction.photoNumber);
              if (this.motionPhotoNumber){
                if(this.motionPhotoNumber < this.state.motionAction.photoNumber){
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
               this.pictureRequested = false;
               this.props.onRequestedPictureTaken(picture.base64);
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
    if (this.camera) {
      try {

        const filename = 
          (this.props.path || RNFetchBlob.fs.dirs.DCIMDir)
          + '/' 
          + date2folderName()
          + '.mp4'

        const promise = this.camera.recordAsync({
          path: filename,
          maxDuration: this.motionActionVideo ? this.state.motionAction.videoLength : 60, // TODO param 60
        });

        if (promise) {
          if(this.props.recording){
            this.props.recording(true);
          }
          this.setState({ isRecording: true });


          const data = await promise;
console.log('video promise',data)

          if (this.stopRecordRequested || this.motionActionVideo) {
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

          // Store video thumb.
          NativeModules.RNioPan.getVideoThumb(filename).then((result) => {
            console.log('thumb',result);
          });
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
              style = {[styles.motionpreview,{/*width:this.previewWidth, height:this.previewHeight*/}]}
              source={{uri: 'data:image/png;base64,' + this.state.motionBase64}}
            />
          : null
        }

        { this.state.motionInputAreaShape
          ? <View style={styles.MotionContainer}>
              { this.state.motionInputAreaShape=='elipse'
                ? <Image 
                    pointerEvents="none"
                    fadeDuration={0}
                    pointerEvents="none"
                    source = {motionMask}
                    resizeMode="stretch"
                    style={[
                      this.state.motionInputAreaStyle,{
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
                  this.state.motionInputAreaStyle,{
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
                  height:this.state.motionInputAreaStyle.top,
                } ]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  left:0,
                  right:0,
                  top: this.state.motionInputAreaStyle.top+this.state.motionInputAreaStyle.height,
                  bottom:0,
                } ]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  top:this.state.motionInputAreaStyle.top,
                  left:0,
                  width: this.state.motionInputAreaStyle.left,
                  height: this.state.motionInputAreaStyle.height,
                }]}
              />
              <View 
                pointerEvents="none"
                style={[styles.motionInputAreaMask,{
                  top:this.state.motionInputAreaStyle.top,
                  right:0,
                  left: this.state.motionInputAreaStyle.left + this.state.motionInputAreaStyle.width,
                  height: this.state.motionInputAreaStyle.height,
                }]}
              />     

              { this.state.motionInputAreaShape=='elipse'
                ? <Svg 
                    pointerEvents="none"
                    style={[
                      styles.motionInputArea, 
                      this.state.motionInputAreaStyle, 
                      {borderWidth:2, borderColor:'transparent'}
                    ]}
                    height={this.state.motionInputAreaStyle.height}
                    width={this.state.motionInputAreaStyle.width}
                    >
                    <Ellipse
                      cx={this.state.motionInputAreaStyle.width/2}
                      cy={this.state.motionInputAreaStyle.height/2}
                      rx={this.state.motionInputAreaStyle.width/2 - 1}
                      ry={this.state.motionInputAreaStyle.height/2 - 1}
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
                      x:this.state.motionInputAreaStyle.left, 
                      y:this.state.motionInputAreaStyle.top
                    }}
                    previewWidth = {this.previewWidth}
                    previewHeight = {this.previewHeight}
                  />
                  <Draggable
                    onMove = {(value) => this.onMoveHandle(1, value) }
                    initialPos = {{
                      x:this.state.motionInputAreaStyle.left+this.state.motionInputAreaStyle.width,
                      y:this.state.motionInputAreaStyle.top+this.state.motionInputAreaStyle.height
                    }}
                    previewWidth = {this.previewWidth}
                    previewHeight = {this.previewHeight}
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


  toggleShape(){
    // Besure displaying right handle on right place (actually reset them).
    if (this.state.motionInputAreaShape=='') {
      this.handles = [{
        x:Math.min(this.handles[0].x, this.handles[1].x),
        y:Math.min(this.handles[0].y, this.handles[1].y),
      },{
        x:Math.max(this.handles[0].x, this.handles[1].x),
        y:Math.max(this.handles[0].y, this.handles[1].y),
      }];
    }

    this.setState({
      // motionSetup: this.state.motionSetup=='action'?'':this.state.motionSetup,
      motionInputAreaShape: 
        this.state.motionInputAreaShape == ''
        ? 'elipse'
        : this.state.motionInputAreaShape == 'elipse'
          ? 'rectangle'
          : ''
    }, function(){this.storeMotionSettings()});
  }

  toggleMotionSetup(val){
    if(this.state.motionSetup && this.state.motionSetup.indexOf(val) != -1){ // watch out threshold / threshold-rvb
      this.setState({
        motionSetup:false,
      });
    }
    else{
      this.setState({
        motionSetup:val,
      }); 
    }
  }

  // toggleMotionOutputRunning(val){
  //   this.setState({motionOutputRunning:val}, function(){this.storeMotionSettings()});
  // }

  renderMotionSetupItems(slider){
    return(
      <View 
        style={{
          position:'absolute', left:0, right:0, top:0, 
          backgroundColor:'rgba(0,0,0,0.5)',
          marginTop: 
            this.state.motionSetup=='action' 
            || (!this.state.motionAction.type || (!this.state.motionAction.photoNumber && !this.state.motionAction.videoLength))
            ? -200
            : this.state.motionSetup=='minimumPixels' 
              ? -sliderHeight-30
              : this.state.motionSetup=='threshold-rvb' 
                ? -sliderHeight*3
                : -sliderHeight
        }}
        >
        <KeyboardAvoidingView behavior="padding">

        {/*
        <Button 
          style={{ 
            margin:1, 
            height:40 ,
            marginBottom:2,
          }}
          color={ this.state.previewing ? '#338433' : 'grey'}
          title = 'Pause motion'
          onPress = {() => this.togglePreviewMotion()}
        />
        */}

        { this.state.motionSetup == 'sampleSize'
        ? <Slider  
            ref="sampleSize"
            style={styles.slider} 
            thumbTintColor = '#ffffff' 
            minimumTrackTintColor='#dddddd' 
            maximumTrackTintColor='#ffffff' 
            minimumValue={-parseInt(this.previewWidth/10,10)}
            maximumValue={-1}
            step={1}
            value={-this.state.sampleSize}
            onValueChange={
              (value) => this.onSampleSize(-value)
            } 
          />

        : this.state.motionSetup == 'threshold'
        ? <Slider  
            ref="threshold"
            style={styles.slider} 
            thumbTintColor = '#ffffff' 
            minimumTrackTintColor='#dddddd' 
            maximumTrackTintColor='#ffffff' 
            minimumValue={-255}
            maximumValue={0}
            step={1}
            // value={this.state.threshold}
            value={
              -(
                (this.state.threshold>>>16) 
              + ((this.state.threshold&0x00ff00)>>>8)
              + (this.state.threshold&0x0000ff)
              )/3
            }
            onValueChange={(value) => this.onThreshold(0xffffff, (-value<<16)|(-value<<8)|-value)} 
          />

        : this.state.motionSetup == 'threshold-rvb'
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
              value={-(this.state.threshold>>>16)}
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
              value={-((this.state.threshold & 0x00ff00) >>> 8)}
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
              value={-(this.state.threshold & 0x0000ff)}
              onValueChange={(value) => this.onThreshold(0x0000ff,-value)} 
            />
            </React.Fragment>

          : this.state.motionSetup == 'minimumPixels'
          ? <React.Fragment>
            <Text 
              style={{
                height:30,
                paddingTop:10,
                color:'#ffffff', 
                // backgroundColor:'rgba(0, 0, 0, 0.4)',//this.state.motionInputAreaShape ? 'transparent' : 'rgba(0, 0, 0, 0.4)'
                fontSize:16,
                textAlign:'center',
              }}
            >{this.state.minimumPixels-1} pixel{this.state.minimumPixels-1>1 ? 's':''}</Text>
            <Slider  
              ref="minimumPixels"
              style={styles.slider} 
              thumbTintColor = '#ffffff' 
              minimumTrackTintColor='#dddddd' 
              maximumTrackTintColor='#ffffff' 
              minimumValue={1}
              maximumValue={Math.min(98,parseInt(this.previewWidth/this.state.sampleSize,10))}
              step={1}
              value={this.state.minimumPixels}
              onValueChange={(value) => this.onMinimumPixels(value)} 
            />
            </React.Fragment>

          : this.state.motionSetup=='action' || (!this.state.motionAction.type || (!this.state.motionAction.photoNumber && !this.state.motionAction.videoLength))
          ? this.renderMotionSetupTodoForm()
          : null
        }

      </KeyboardAvoidingView>
      </View>
    );
  }

  renderCamActionButtons(){   
    return (
      <View key="renderCamActionButtons" style={[styles.iconButtonContainer,
        {
         width: this.previewWidth,
        }]} >
        <View style={styles.iconButton}>
        <MaterialCommunityIcons.Button   
          name='camera'
          underlayColor={'white'}
          size={40}
          width={100}
          margin={0}
          paddingLeft={30}
          color= { this.state.isTakingPicture ? colors.purple : colors.greenFlash}
          backgroundColor ={'transparent'}
          // onPress = {() =>{}}
          onPress = {() => this.takePicture()}
        /></View>

        { this.state.cam.indexOf('collection-') < 0
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
            color= { this.state.isRecording ? colors.purple : colors.greenFlash}
            backgroundColor ={'transparent'}

            onPress={
              this.state.isRecording 
              ? () => {
                  this.stopRecordRequested = true;
                  this.camera.stopRecording()
                }
              : () => this.takeVideo()
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
            color= {this.state.motionDetectionMode==MODE_RUN ? colors.purple : colors.greenFlash }
            backgroundColor ={'transparent'}
            onPress = {() => this.onMotionButton()}
          /></View>
           
          { this.state.motionsCount
            ? <Text style={{
                marginTop:-40, marginLeft:-30, textAlign:'center',
                height:20,width:20, backgroundColor:colors.purple, borderRadius:20,
                color:'white', fontSize:12, fontWeight:'bold',
                }}>
                {this.state.motionsCount}</Text>
            : null
          }
              
          </React.Fragment>
          :null
        }
      </View>
    );
    
  }

  toggleMotionAction(type){
    this.setState({motionAction:{
      ...this.state.motionAction,
      type:type,
    }},function(){this.storeMotionSettings()}
    );
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

    this.setState({
      motionAction:{
        ...this.state.motionAction,
        [key]:val
      },
      motionSetup:false,
    },function(){
      this.storeMotionSettings();
    });
    
  }

  storeMotionSettings(){
    AsyncStorage.setItem('motion_parameters', JSON.stringify({
      motionAction:         this.state.motionAction,
      // motionOutputRunning:  this.state.motionOutputRunning,
      // motionDetectionMode:  this.state.motionDetectionMode,
      threshold:            this.state.threshold,
      sampleSize:           this.state.sampleSize,
      minimumPixelskey:     this.state.minimumPixels,
      motionInputAreaShape: this.state.motionInputAreaShape,
      motionInputAreaStyle: this.state.motionInputAreaStyle,
      storage:              this.state.storage,
    }));
  }

  renderMotionSetupTodoForm(){
    return(
      <View style={{height:200, padding:10, backgroundColor: '#fafaff',}}>
        {/*<Text style={{padding:10, fontSize:16, textAlign:'center', color:colors.greenFlash,}}>Lorsqu'un mouvement est détecté</Text>*/}
        <Text style={{paddingTop:10, fontSize:18, fontWeight: 'bold', textAlign:'center', color:colors.greenFlash,}}>
          Action en cas de mouvement
        </Text>

        <View style={[styles.row, {justifyContent: 'space-between',flex:1, marginTop:5}]}>

          <View style={{flex:0.5}}>
            { this.state.motionAction.type == 'photo' 
              ? <View 
                  style={{
                    flexDirection:'row', 
                    flex:1, 
                    justifyContent:'center',
                    flexWrap: 'wrap', 
                    alignItems: 'flex-start',
                  }}>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  une </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  série </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  de </Text>
                <TextInput
                  keyboardType="number-pad"
                  //autoFocus={true}
                  textAlign={'center'}
                  style={{backgroundColor:'white', width:30, height:30, borderWidth:1, borderColor:colors.greenDark, padding:0, margin:0}}
                  defaultValue={''+this.state.motionAction.photoNumber}
                  onEndEditing =    {(event) => this.setMotionActionValue('photoNumber', parseInt(event.nativeEvent.text,10)) } 
                  onSubmitEditing = {(event) => this.setMotionActionValue('photoNumber', parseInt(event.nativeEvent.text,10)) } 
                />
                <Text style={[{fontSize:18, color: colors.greenFlash}]}> photo{this.state.motionAction.photoNumber>1?'s':''}.</Text>
                </View>

              : <TouchableOpacity onPress = {() => this.toggleMotionAction('photo')}>
                  <Text style={[{fontSize:18, padding:10, textAlign: 'center',
                    color: this.state.motionAction.type=='photo' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre une série de photos</Text>
                </TouchableOpacity>
            }
          </View>

          <View style={[{flex:0.5}]}>
            { this.state.motionAction.type == 'video' 
              ? <View 
                  style={{
                    flexDirection:'row', 
                    flex:1, 
                    justifyContent:'center',
                    flexWrap: 'wrap', 
                    alignItems: 'flex-start',
                  }}>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  Prendre </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  une </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  vidéo </Text>
                  <Text style={[{fontSize:18, color: this.state.motionAction.type=='video' ? colors.greenFlash : colors.greenDark}]}>
                  de </Text>
                  <TextInput
                    keyboardType="number-pad"
                    // autoFocus={true}
                    textAlign={'center'}
                    style={{backgroundColor:'white', width:30, height:30, borderWidth:1, borderColor:colors.greenDark, padding:0, margin:0}}
                    defaultValue={''+this.state.motionAction.videoLength}
                    onEndEditing =    {(event) => this.setMotionActionValue('videoLength', parseInt(event.nativeEvent.text,10)) } 
                    onSubmitEditing = {(event) => this.setMotionActionValue('videoLength', parseInt(event.nativeEvent.text,10)) } 
                  />
                  <Text style={{fontSize:18, color: colors.greenFlash}}> seconde{this.state.motionAction.videoLength>1?'s':''}.</Text>
                </View>

              : <TouchableOpacity onPress = {() => this.toggleMotionAction('video')}>
                  <Text style={{fontSize:18, textAlign:'center', padding:10,
                    color: this.state.motionAction.type=='video' ? colors.greenFlash : colors.greenDark
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

  renderMotionSetupButtons(){   
    return(  
      <View key="renderMotionSetupButtons" style={{flex: 1, justifyContent:'space-between'}}>

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
                  this.state.motionSetup=='action' || (!this.state.motionAction.type || (!this.state.motionAction.photoNumber && !this.state.motionAction.videoLength)) 
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
                color:this.state.motionInputAreaShape ? colors.greenFlash : 'grey' ,}}
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
              color:this.state.motionSetup=='sampleSize' ? colors.greenFlash : 'grey' ,}}
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
              color:this.state.motionSetup && this.state.motionSetup.indexOf('threshold') != -1 
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
              color:this.state.motionSetup=='minimumPixels' ? colors.greenFlash : 'grey' ,}}
              >Antibruit</Text>
          </TouchableOpacity>
        </ScrollView>
      
        <View></View>

        { // Do not show Launch / Close buttons if we open cam to setup motion detector.
        this.props.mode == 'motion-setup' && this.props.mode_ == MODE_SET
        ? null
        : <View 
            style={{ 
            flexDirection:'row', 
            backgroundColor:colors.greenFlash}}
            >
            <TouchableOpacity 
              onPress = {() => this.closeSetupMotion()}
              style={{padding:10, 
                flex:this.state.motionAction.type && (this.state.motionAction.photoNumber || this.state.motionAction.videoLength)?0.5:1,
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

            { this.state.motionAction.type && (this.state.motionAction.photoNumber || this.state.motionAction.videoLength)
              ? <TouchableOpacity 
                onPress = {() => this.takeMotion()}
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

  renderCamera() {
    // TODO:
    // if(this.state.connectedTo && this.camRequested){
    //   this.camRequested = false;
    //   this.sendMessage(this.state.connectedTo, 'distantcam', true);
    // }

    return (
      <View //ViewShot
        key="renderCamera"
        ref="viewShot"
        // options={{
        //   format: "jpg", 
        //   quality:1 ,
        // }}
      >
      <RNCamera
        ref={cam => (this.camera = cam)}
        style = {[styles.cam,{width:this.previewWidth, height:this.previewHeight}]}
        onCameraReady = {this.onCameraReady}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.off}
        ratio="4:3"
        autoFocus ={RNCamera.Constants.AutoFocus.on}
        zoom={this.state.zoom}

        motionDetectionMode={this.state.motionDetectionMode}
        onMotionDetected={this.onMotionDetected}
        motionDetectionMinimumPixels={this.state.minimumPixels}
        motionDetectionThreshold={this.state.threshold}
        motionDetectionSampleSize={this.state.sampleSize}
        motionDetectionArea={ 
          this.state.motionInputAreaShape == ''
          ? ""
          : this.state.motionInputAreaShape +";"+
            Math.ceil(this.state.motionInputAreaStyle.left/this.state.sampleSize) +";"+ 
            Math.ceil(this.state.motionInputAreaStyle.top /this.state.sampleSize) +";"+
            Math.floor(this.state.motionInputAreaStyle.width /this.state.sampleSize) +";"+
            Math.floor(this.state.motionInputAreaStyle.height /this.state.sampleSize) +";"
        }
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

       </RNCamera>
    
      </View>
    );
  }

  onThreshold(mask, color){
    const threshold = this.state.threshold & ~mask | color;
    this.setState({threshold:threshold}, function(){this.storeMotionSettings()});
  }

  onMinimumPixels(value){
    this.setState({minimumPixels:value}, function(){this.storeMotionSettings()});
  }

  onSampleSize(value){
    let minimumPixels = this.state.minimumPixels;
    if(minimumPixels > this.previewHeight/value){
      minimumPixels = parseInt(this.previewHeight/value);
    }
    this.setState({
      sampleSize:value,
      minimumPixels:minimumPixels,
    }, function(){this.storeMotionSettings()});
  }

  onZoom(value){
    this.setState({zoom:value});
  };

  onMoveHandle(id, value){
    this.handles[id]=value;
    this.setState({motionInputAreaStyle:{
      top: Math.min(this.handles[0].y, this.handles[1].y),
      left: Math.min(this.handles[0].x, this.handles[1].x),
      width: Math.abs(this.handles[0].x - this.handles[1].x),
      height: Math.abs(this.handles[0].y - this.handles[1].y),
    }}, function(){ 
      // this.handles = [{ 
      //   x: Math.min(this.handles[0].x,this.handles[1].x),
      //   y: Math.min(this.handles[0].y,this.handles[1].y),
      //   },{
      //   x: Math.max(this.handles[0].x,this.handles[1].x),
      //   y: Math.max(this.handles[0].y,this.handles[1].y),
      // }];
      this.storeMotionSettings();
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
          ? this.renderMotionSetupButtons()
          : this.renderCamActionButtons()
        }

      {/* TODO: bigBlackMask button  */ }

      </View>
    );
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
});
