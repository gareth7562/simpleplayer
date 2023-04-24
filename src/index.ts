
import { QMainWindow, QTabWidget, QWidget, QClipboardMode, QApplication, ButtonRole,
  QMessageBox, QLabel, FlexLayout, QKeyEvent, QVariant, QPushButton, QPixmap, QLineEdit, QIcon, QListWidget, QListWidgetItem, QSettings,
  QSize, SizeAdjustPolicy, ResizeMode, ItemDataRole, QUrl, QBoxLayout, QGridLayout, QFileDialog, FileMode, WidgetEventTypes, Key, 
  QMenu, QPoint, QClipboard, QCheckBox, QBrush, QColor, QSettingsFormat } from '@nodegui/nodegui';
import * as defaults from './theme'
import { connect } from 'http2';
import { eventNames } from 'process';
import { EventWidget } from '@nodegui/nodegui/dist/lib/core/EventWidget';
var fs = require('fs')

const settings = new QSettings("SimplePlayer software", "SimplePlayer");
var tempText = "";
var loading = false;

var nextPageToken = 0;

const axios = require('axios');
const youtubesearchapi = require("youtube-search-api")


settings.sync();
var pathToMpv = "\"" + process.cwd() + '/mpv/mpv.exe' + "\""
if(settings.value("mpvdir").toString().length > 0)
{
  pathToMpv = settings.value("mpvdir").toString()
}
var items = Array<QListWidgetItem>();

const util = require("node:util");


const execFile = util.promisify(require("node:child_process").execFile);

const win = new QMainWindow();

const tabWidget = new QTabWidget();
win.setWindowTitle("Simple Youtube Player");
win.setMinimumSize(800, 600);

const loadingLabel = new QLabel();
loadingLabel.setText("");


const videoList = new QListWidget();
const history = new QListWidget();

const centralWidget = new QWidget();
centralWidget.setObjectName("myroot");
const rootLayout = new FlexLayout();
centralWidget.setLayout(rootLayout);

const buttonWidget = new QWidget();
buttonWidget.setObjectName("buttons");
const buttonLayout = new FlexLayout();
const searchButton = new QPushButton();


const settingsLayout = new FlexLayout();
const settingsWidget = new QWidget();
settingsWidget.setLayout(settingsLayout);

const playerPath = new QLineEdit();
const playerLabel = new QLabel();
const playerBrowseButton = new QPushButton();

playerBrowseButton.setText("Browse");

playerLabel.setText("mpv Path");

settingsLayout.addWidget(playerLabel);
settingsLayout.addWidget(playerPath);
settingsLayout.addWidget(playerBrowseButton);

playerBrowseButton.addEventListener('clicked', () => {
  findMPV();
})



buttonWidget.setLayout(buttonLayout);

buttonLayout.addWidget(searchButton);

searchButton.setInlineStyle("margin-right: 2px;")

const filesearch = new QLineEdit();
videoList.setInlineStyle("flex: 1;");
const playButton = new QPushButton();

const shareButton = new QPushButton();
shareButton.setText("Share");

shareButton.addEventListener("clicked", () => {

  
  const clipboard = QApplication.clipboard();

  if(tabWidget.currentIndex() == 0)
  {
  if(videoList.items.size > 0)
  {
  clipboard?.setText(videoList.currentItem().toolTip())
  messageBox("URL from video list copied to clipboard", "Copied URL")
  }

  }
  if(tabWidget.currentIndex() == 1)
  {
    if(history.items.size > 0)
    {
      clipboard?.setText(history.currentItem().toolTip())
      messageBox("URL from history copied to clipboard", "Copied URL")
    }
  }

  
  
})

function messageBox(message:string, title: string)
{
  const messageBox = new QMessageBox();
  const accept = new QPushButton();
  accept.setText('OK');
  messageBox.addButton(accept, ButtonRole.AcceptRole);
  messageBox.setWindowTitle(title)
  messageBox.setText(message);
  messageBox.exec()
}
  

searchButton.setText("Search")
playButton.setText("Play")
rootLayout.addWidget(filesearch);


searchButton.addEventListener('clicked', () => {
  videoList.clear();
  search(false);
})


function newHistoryItem()
{
    if(disableHistoryCheckBox.isChecked() == false)
    {
    const newHistoryItem = new QListWidgetItem()

    newHistoryItem.setText(videoList.currentItem().text())
    newHistoryItem.setToolTip(videoList.currentItem().toolTip())
    history.addItem(newHistoryItem);
    fs.appendFile("history.txt", newHistoryItem.text()  + "," + newHistoryItem.toolTip() +  ',' + '\n', (err:any) => {
      if (err) {
        console.log(err);
      }
      })

    }
  
}

async function loadHistory()
{

  if(fs.existsSync('history.txt') == false)
  {
    disableHistoryCheckBox.setChecked(true);
  }

  if(disableHistoryCheckBox.isChecked() == false)
  {

  if(fs.existsSync('history.txt'))
  {
    const array = fs.readFileSync('history.txt').toString().split("\n");
      for(var i = 0; i < array.length - 1; i++) {
      var tokens:Array<string> = array[i].split(',')

      console.log(tokens);

      const newHistoryItem = new QListWidgetItem()

      newHistoryItem.setText(tokens[0]);
      newHistoryItem.setToolTip(tokens[1]);

      history.addItem(newHistoryItem)
    }
  }
}
else
{
  deleteHistoryFile();
}
}
     

function deleteHistoryFile()
{
  if(fs.existsSync('history.txt'))
  {
    fs.unlinkSync('history.txt');
  }
  history.clear();
}

rootLayout.addWidget(buttonWidget);


rootLayout.addWidget(tabWidget);
buttonLayout.addWidget(playButton);
buttonLayout.addWidget(shareButton);
playButton.setInlineStyle("margin-right: 2px;")

history.addEventListener('doubleClicked', () => {
  if(!loading)
  {
    const file = history.currentItem().toolTip();
    setIsLoading();
    launchMPV(file, playerPath.text());

  }
})

videoList.addEventListener('doubleClicked',  () => {


  if(!loading)
  {
    const file = videoList.currentItem().toolTip();
    newHistoryItem();
    setIsLoading();
    launchMPV(file, playerPath.text());
  
  }
});
playButton.addEventListener('clicked', () => {

  var file = "";



  if(!loading)
  {
  if(tabWidget.currentIndex() == 0)
  {

    if(videoList.items.size == 0 )
    {
      return;
    }

    newHistoryItem();
    file = videoList.currentItem().toolTip();
    
  }
  else
  {
    if(history.items.size == 0 )
    {
      return;
    }
    file = history.currentItem().toolTip();
  }

  setIsLoading();

  launchMPV(file, playerPath.text());
  
  }

});

const disableHistoryCheckBox = new QCheckBox();
disableHistoryCheckBox.setText("Disable History");

disableHistoryCheckBox.addEventListener('clicked', (checked:Boolean) => {


  if(checked)
  {
      tabWidget.removeTab(1);
      deleteHistoryFile();
  }
  else
  {
    tabWidget.insertTab(1, history, new QIcon, "History");
    fs.closeSync(fs.openSync('history.txt', 'w'));
  }
    
})

settingsLayout.addWidget(disableHistoryCheckBox);

tabWidget.setInlineStyle("flex: 1;");
tabWidget.addTab(videoList, new QIcon, "Results");
tabWidget.addTab(settingsWidget, new QIcon, "Settings");


settingsWidget.setObjectName("settings");

filesearch.addEventListener("returnPressed", () => {
  videoList.clear();
  search(false);
  

});


playerPath.setText(pathToMpv);
win.setCentralWidget(centralWidget);

rootLayout.addWidget(loadingLabel);

const nextPageButton = new QPushButton()

nextPageButton.setText("Next Page")
nextPageButton.setVisible(false);
rootLayout.addWidget(nextPageButton)


nextPageButton.addEventListener('clicked', () => {
  search(true);
})
win.show();

loadHistory();
if(!disableHistoryCheckBox.isChecked())
tabWidget.insertTab(1,history, new QIcon, "History");




(global as any).win = win;


async function search(nextPage:boolean)
{


    if(filesearch.text().length == 0 && nextPage == false)
    {
      nextPageButton.setVisible(false)
      return;
    }

    var vids;
    if(nextPage)
    {
      videoList.clear();
      vids = await youtubesearchapi.NextPage(nextPageToken)
      
    }
    else
    {
      vids  = await youtubesearchapi.GetListByKeyword(filesearch.text(), false)
      nextPageToken = vids.nextPage

    } 
    for(const element of vids.items)
    {
    if(element.type == 'video')
    {
    console.log(element);
    const url = element.thumbnail.thumbnails[0].url;
    const newItem = new QListWidgetItem();

    try {
    const image = await getPixmap(url)
    const icon = new QIcon(image);
    newItem.setIcon(icon);
    } catch(error) {
      console.log("Error retrieving image")
    }


    newItem.setText(element.title + " (" + element.channelTitle + ")");
    newItem.setToolTip('https://www.youtube.com/watch?v=' + element.id)
    videoList.setIconSize(new QSize(128, 128));
    items.push(newItem)
    videoList.addItem(newItem);
    
    console.log(element.thumbnail.thumbnails[0].url)
    }
  }
    nextPageButton.setVisible(true)
    videoList.setCurrentRow(0);


}

async function launchMPV(filename:any, path:string) {

  var childProcess = require('child_process');
  childProcess.exec(path + ' ' + filename, function (err: any, stdout: any) {
        if (err) {
        console.error(err);
        return;
    }
    console.log(stdout);
    loading = false;
    loadingLabel.setText("");
})

}

function findMPV()
{
  const dialog = new QFileDialog(centralWidget, "Select path to mpv executable", undefined);
  dialog.setFileMode(FileMode.AnyFile);
  
  if(dialog.exec())
  {
    const path = "\"" + dialog.selectedFiles()[0] + "\""
    playerPath.setText(path);
    settings.setValue("mpvdir", path);
    settings.sync();
  }
}

centralWidget.setStyleSheet(defaults.theme);

async function getPixmap(url:String) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer' });
  const pixmap = new QPixmap();
  pixmap.loadFromData(data);
  return pixmap;
}

function setIsLoading()
{

  loading = true;
  loadingLabel.setText("Loading mpv...")
}

