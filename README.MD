[![ReadMeSupportPalestine](https://raw.githubusercontent.com/Safouene1/support-palestine-banner/master/banner-support.svg)](https://techforpalestine.org/learn-more)
# HaramBlur Extension
HaramBlur is a browser extension that allows you to navigate the web with respect for your Islamic values, privacy and reduce browsing distractions.

HaramBlur utilizes face detection and NSFW content detection and provides controls that allow you to uphold the Islamic gaze protection principle and tailor your online experience by automatically blurring images and videos that contain unwanted or impermissible content. 

You can configure the type of detection you want and the amount of blur, hover to unblur, choose a specific gender to blur, or turn the extension on and off via the interactive pop-up 😄

![HaramBlur Demo](demos/demo1.png)


## Features

- Works on images and videos that contain unwanted or impermissible content
- Works on most (if not all) websites and social media platforms
- Configurable detection settings to tailor your browsing experience
- Interactive pop-up for easy on/off toggling 
- Customizable hover to unblur feature
- Decent speed and accuracy (can be improved)

## How it Works

HaramBlur currently used face detection and recognition features provided by [Human library](https://github.com/vladmandic/human) to detect faces and blur them based on the user settings and preferences. It also uses NSFW detection provided by [nsfwjs](https://github.com/infinitered/nsfwjs/) to further improve the accuracy. You can configure the type of detection you want and the amount of blur, hover to unblur, or turn the extension on and off via the interactive pop-up.

## Installation
1. Clone the repository
2. run `npm install`
3. code your magic
4. run `npm run build` to build the extension, then load the extension in Chrome by going to `chrome://extensions/` and clicking on `Load unpacked`  (developer mode has  to be on) and selecting the project folder.
5. Or run `npm run release` to generate a zip file for the extension to be uploaded to the browser/store.


## Improvements

Here are some planned improvements that could be made to HaramBlur:

- Support for more browsers
- Improve the speed of detection
- Improve the accuracy of NSFW detection to reduce false positives and negatives
- Make the extension more Shariah-compliant by adding additional privacy controls and customization options

## Open Source

HaramBlur is an open-source project and I really appreciate any contributions. Feel free to open an issue or submit a pull request if you have any suggestions or improvements you would like to see.

## Like the project?

If you like the project, please consider giving it a star ⭐️. If you wanna further support me, [buy me a coffee ☕️](https://www.buymeacoffee.com/alganzory), thank you! 😊
