@ECHO OFF
SETLOCAL

SET APP_HOME=%~dp0

IF DEFINED JAVA_HOME (
  SET JAVACMD=%JAVA_HOME%\bin\java.exe
) ELSE (
  SET JAVACMD=java.exe
)

"%JAVACMD%" -classpath "%APP_HOME%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
