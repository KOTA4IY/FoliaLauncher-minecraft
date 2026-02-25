import sys
import webview
import minecraft_launcher_lib
import subprocess
import os
import uuid
import threading
import json
import requests
import platform
import time
import shutil
import xml.etree.ElementTree as ET
import zipfile
from src.backend.api import LauncherApi

if __name__ == "__main__":
    api = LauncherApi()
    
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
        
    html_path = os.path.join(base_path, 'src', 'index.html')
    window = webview.create_window('FoliaLauncher', url=html_path, js_api=api, width=1100, height=700, background_color='#1e1e1e')
    api.set_window(window)
    webview.start(debug=False)
