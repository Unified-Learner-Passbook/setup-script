// service.ts - a nestjs provider using console decorators
import { Console, Command, createSpinner } from 'nestjs-console';
import { AxiosRequestConfig } from 'axios';
import { HttpService } from '@nestjs/axios';

//generate fake words
const { faker } = require('@faker-js/faker');

//file stream
const fs = require('fs');

@Console()
export class AppService {
  constructor(public readonly httpService: HttpService) {}
  @Command({
    command: 'ulp',
  })
  async ulpConsole(): Promise<void> {
    const moment = require('moment');
    //read and write csv
    const csvParser = require('csv-parser');
    const { stringify } = require('csv-stringify');
    //FormData
    const FormData = require('form-data');
    //start console
    const spin = createSpinner();
    //md5 hash
    const md5 = require('md5');

    //loading
    console.log(
      `This script will create will guide you to setup credential system`,
    );
    spin.start(`Loading Environment Variables from the .env file...`);
    let ULPCLI_VERSION = null;
    let ULPCLI_NAME = null;
    let BULK_ISSUANCE_URL = null;
    let EWALLET_URL = null;
    let VERIFICATION_URL = null;
    let envs = await new Promise((done) =>
      setTimeout(() => {
        ULPCLI_VERSION = process.env.ULPCLI_VERSION;
        ULPCLI_NAME = process.env.ULPCLI_NAME;
        BULK_ISSUANCE_URL = process.env.BULK_ISSUANCE_URL;
        EWALLET_URL = process.env.EWALLET_URL;
        VERIFICATION_URL = process.env.VERIFICATION_URL;
        done({
          ULPCLI_VERSION: ULPCLI_VERSION,
          ULPCLI_NAME: ULPCLI_NAME,
          BULK_ISSUANCE_URL: BULK_ISSUANCE_URL,
          EWALLET_URL: EWALLET_URL,
          VERIFICATION_URL: VERIFICATION_URL,
        });
      }, 2000),
    );
    spin.succeed('Environment Variables Loaded.');
    console.log(JSON.stringify(envs, null, '\t'));

    //client token
    spin.start(
      `Keycloak admin account is getting created (This token will use to call bulk credential API's)...`,
    );
    let client_response = await new Promise<any>(async (done) => {
      const data = JSON.stringify({
        password: 'test@4321',
      });
      const url = BULK_ISSUANCE_URL + '/bulk/v1/clienttoken';
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'application/json',
        },
      };
      let response_data = null;
      try {
        const observable = this.httpService.post(url, data, config);
        const promise = observable.toPromise();
        const response = await promise;
        response_data = response.data;
      } catch (e) {
        response_data = { error: e };
      }
      done(response_data);
    });
    if (client_response?.error || client_response?.success === false) {
      spin.fail('Client Token Failed.');
      console.log(
        JSON.stringify(
          client_response?.error
            ? client_response.error
            : client_response?.result
            ? client_response.result
            : {},
          null,
          '\t',
        ),
      );
    } else {
      spin.succeed('Got Client Token.');
      let client_token = client_response.token;
      console.log(
        JSON.stringify(
          {
            'Client Token': client_token,
          },
          null,
          '\t',
        ),
      );

      //generate did
      spin.start(`Creating Identity key for the school `);
      let ISSUER_ID = 'school_' + Math.floor(Math.random() * 1000 + 1);
      let did_response = await new Promise<any>(async (done) => {
        const data = JSON.stringify({
          uniquetext: ISSUER_ID,
        });
        const url = BULK_ISSUANCE_URL + '/bulk/v1/getdid';
        const config: AxiosRequestConfig = {
          headers: {
            'Content-Type': 'application/json',
          },
        };
        let response_data = null;
        try {
          const observable = this.httpService.post(url, data, config);
          const promise = observable.toPromise();
          const response = await promise;
          response_data = response.data;
        } catch (e) {
          response_data = { error: e };
        }
        done(response_data);
      });
      if (did_response?.error || did_response?.success === false) {
        spin.fail('Issuer Identity creation failed');
        console.log(
          JSON.stringify(
            did_response?.error
              ? did_response.error
              : did_response?.result
              ? did_response.result
              : {},
            null,
            '\t',
          ),
        );
      } else {
        spin.succeed('Issuer Identity created successfully');
        let ISSUER_DID = did_response.result;
        console.log(
          JSON.stringify(
            {
              DID: ISSUER_DID,
            },
            null,
            '\t',
          ),
        );

        //issuer register
        spin.start(`Saving Issuer information in registry...`);
        const issuer_data = {
          name: ISSUER_ID,
          did: ISSUER_DID,
        };
        const data = JSON.stringify(issuer_data);
        let issuer_invite_response = await new Promise<any>(async (done) => {
          const url = BULK_ISSUANCE_URL + '/bulk/v1/issuerregister';
          const config: AxiosRequestConfig = {
            headers: {
              Authorization: 'Bearer ' + client_token,
              'Content-Type': 'application/json',
            },
          };
          let response_data = null;
          try {
            const observable = this.httpService.post(url, data, config);
            const promise = observable.toPromise();
            const response = await promise;
            response_data = response.data;
          } catch (e) {
            response_data = { error: e };
          }
          done(response_data);
        });
        if (
          issuer_invite_response?.error ||
          issuer_invite_response?.success === false
        ) {
          spin.fail('Storing issuer credentials failed');
          console.log(
            JSON.stringify(
              issuer_invite_response?.error
                ? issuer_invite_response.error
                : issuer_invite_response?.result
                ? issuer_invite_response.result
                : {},
              null,
              '\t',
            ),
          );
        } else {
          spin.succeed('Issuer information stored successfully.');
          console.log(JSON.stringify(issuer_data, null, '\t'));

          //create sample schema
          spin.start(`Getting Sample Schema...`);
          let UNIQUE_SCHEMA_TAG =
            'unique_schema_' + Math.floor(Math.random() * 100000 + 1);
          let create_schema_list = await new Promise<any>(async (done) => {
            //get create_schema_list
            try {
              let sample_schema_dir = __dirname + '/sample_schemas/';
              await this.readFiles(
                this.httpService,
                sample_schema_dir,
                async function (httpService: HttpService, filename, content) {
                  //console.log(filename);
                  //console.log(content);
                  let file_json = JSON.parse(content);
                  //generate did
                  let UNIQUE_ID =
                    'unique_' + Math.floor(Math.random() * 1000 + 1);
                  let did_response = await new Promise<any>(
                    async (done_did) => {
                      const data = JSON.stringify({
                        uniquetext: UNIQUE_ID,
                      });
                      const url = BULK_ISSUANCE_URL + '/bulk/v1/getdid';
                      const config: AxiosRequestConfig = {
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      };
                      //console.log(data);
                      let response_data = null;
                      try {
                        //let httpService = HttpService;
                        const observable = httpService.post(url, data, config);
                        const promise = observable.toPromise();
                        const response = await promise;
                        response_data = response.data;
                      } catch (e) {
                        console.log('error' + e);
                        response_data = { error: e };
                      }
                      done_did(response_data);
                    },
                  );
                  //console.log(JSON.stringify(did_response));
                  if (did_response?.error || did_response?.success === false) {
                  } else {
                    let UNIQUE_DID = did_response.result;
                    //create schema
                    file_json.schema.id = UNIQUE_DID;
                    //UNIQUE_SCHEMA_TAG
                    file_json.tags.push(UNIQUE_SCHEMA_TAG);
                    //console.log(file_json);
                    //create schema
                    let schema_response = await new Promise<any>(
                      async (done_schema) => {
                        const data = JSON.stringify(file_json);
                        const url =
                          BULK_ISSUANCE_URL +
                          '/bulk/v1/credential/schema/create';
                        const config: AxiosRequestConfig = {
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        };
                        //console.log(data);
                        let response_data = null;
                        try {
                          //let httpService = HttpService;
                          const observable = httpService.post(
                            url,
                            data,
                            config,
                          );
                          const promise = observable.toPromise();
                          const response = await promise;
                          response_data = response.data;
                        } catch (e) {
                          console.log('error' + e);
                          response_data = { error: e };
                        }
                        done_schema(response_data);
                      },
                    );
                    //console.log(schema_response);
                  }
                  //sample_schema.push({ filename: filename, content: content });
                },
                function (err) {
                  console.log(err);
                  throw err;
                },
                function (sample_schema) {
                  //end cerate schema list
                  //console.log(sample_schema);
                  done([]);
                },
              );
            } catch (e) {
              console.log(e);
            }
          });
          //console.log(create_schema_list);
          if (create_schema_list === null) {
            spin.fail('Failed to get Sample Schema');
          } else {
            spin.succeed('Created Sample Schema');

            //console.log(JSON.stringify(create_schema_list, null, '\t'));
            spin.start(`Getting Schema List of tag...${UNIQUE_SCHEMA_TAG}`);

            //aading 3 seconds wait for gettign created schema
            await this.delay(5000);

            //console.log('UNIQUE_SCHEMA_TAG', UNIQUE_SCHEMA_TAG);
            let scheam_tag_text = UNIQUE_SCHEMA_TAG;
            let schema_response = await new Promise<any>(async (done) => {
              var data = JSON.stringify({
                taglist: scheam_tag_text,
              });
              const url = BULK_ISSUANCE_URL + '/bulk/v1/credential/schema/list';
              const config: AxiosRequestConfig = {
                headers: {
                  'Content-Type': 'application/json',
                },
              };
              //console.log(data);
              let response_data = null;
              try {
                const observable = this.httpService.post(url, data, config);
                const promise = observable.toPromise();
                const response = await promise;
                response_data = response.data;
                //console.log(response_data);
              } catch (e) {
                response_data = { error: e };
              }
              done(response_data);
            });
            if (schema_response?.error || schema_response?.success === false) {
              spin.fail('Failed to get schema list');
              console.log(
                JSON.stringify(
                  schema_response?.error
                    ? schema_response.error
                    : schema_response?.result
                    ? schema_response.result
                    : {},
                  null,
                  '\t',
                ),
              );
            } else {
              spin.succeed(`Got Schema List of tag...${UNIQUE_SCHEMA_TAG}`);
              let schema_list = schema_response.result;
              console.log(
                JSON.stringify(
                  {
                    'Schema List': schema_list,
                  },
                  null,
                  '\t',
                ),
              );
              //create sample data
              //generate dob
              const startDate_dob = new Date('1990-01-01');
              const endDate_dob = new Date('2005-12-31');
              const timeDiff_dob =
                endDate_dob.getTime() - startDate_dob.getTime();
              const startDate = new Date('2020-01-01');
              const endDate = new Date('2022-12-31');
              const timeDiff = endDate.getTime() - startDate.getTime();
              //generate sample data
              let data_limit = 10;
              let sample_data_test = [];
              let gender_data = ['M', 'F'];
              for (let i = 0; i < data_limit; i++) {
                let student_first_name = faker.person.firstName();
                let student_last_name = faker.person.lastName();
                let student_username_name_temp =
                  student_first_name +
                  '_' +
                  Math.floor(Math.random() * 1000 + 1);
                let student_username_name =
                  student_username_name_temp.toLowerCase();
                let student_password = student_username_name;
                let student_full_name =
                  student_first_name + ' ' + student_last_name;
                let student_id =
                  Math.floor(Math.random() * 1000 + 1) +
                  '_' +
                  student_username_name;
                const randomTime_dob = Math.random() * timeDiff_dob;
                const randomDate_dob = new Date(
                  startDate_dob.getTime() + randomTime_dob,
                );
                const randomDate_dob_txt = randomDate_dob
                  .toISOString()
                  .slice(0, 10);
                let student_dob = randomDate_dob_txt;
                const randomTime = Math.random() * timeDiff;
                const randomDate = new Date(startDate.getTime() + randomTime);
                let student_aadhar_token = md5(student_id);
                sample_data_test.push({
                  student_name: student_full_name,
                  dob: student_dob,
                  gender:
                    gender_data[Math.floor(Math.random() * gender_data.length)],
                  aadhar_token: student_aadhar_token,
                  password: student_username_name,
                  username: student_password,
                  recoveryphone: '9999999999',
                });
              }
              console.log(
                JSON.stringify(
                  {
                    'Sample User Data': sample_data_test,
                  },
                  null,
                  '\t',
                ),
              );
              //do untill all schemas data created
              for (
                let i_schema = 0;
                i_schema < schema_list.length;
                i_schema++
              ) {
                console.log('#################');
                console.log(schema_list[i_schema].schema_name);
                console.log('#################');
                //get first schema
                spin.start(
                  `Getting Required Fields from ...${schema_list[i_schema].schema_name} schema`,
                );
                let schema_filed_response = await new Promise<any>(
                  async (done) => {
                    const data = JSON.stringify({
                      schema_id: schema_list[i_schema].schema_id,
                    });
                    const url =
                      BULK_ISSUANCE_URL + '/bulk/v1/credential/schema/fields';
                    const config: AxiosRequestConfig = {
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    };
                    let response_data = null;
                    try {
                      const observable = this.httpService.post(
                        url,
                        data,
                        config,
                      );
                      const promise = observable.toPromise();
                      const response = await promise;
                      response_data = response.data;
                    } catch (e) {
                      response_data = { error: e };
                    }
                    done(response_data);
                  },
                );
                if (
                  schema_filed_response?.error ||
                  schema_filed_response?.success === false
                ) {
                  spin.fail('Failed to get schema fields');
                  console.log(
                    JSON.stringify(
                      schema_filed_response?.error
                        ? schema_filed_response.error
                        : schema_filed_response?.result
                        ? schema_filed_response.result
                        : {},
                      null,
                      '\t',
                    ),
                  );
                } else {
                  spin.succeed(
                    `Got Schema Required Fields...${schema_list[i_schema].schema_name}`,
                  );
                  /*console.log(
                    JSON.stringify(
                      {
                        'Schema Field List': schema_filed_response,
                      },
                      null,
                      '\t',
                    ),
                  );*/
                  //create sample data
                  let data_fields =
                    schema_filed_response?.result?.required.concat(
                      schema_filed_response?.result?.optional,
                    );
                  //if dob and gender then give some sample data filed
                  /*console.log(
                    JSON.stringify(
                      {
                        'Sample Data Field': data_fields,
                      },
                      null,
                      '\t',
                    ),
                  );*/
                  //create sample data
                  let sent_scehma_subjects = [];
                  for (let i = 0; i < data_limit; i++) {
                    let newobj = new Object();
                    for (let j = 0; j < data_fields.length; j++) {
                      let sample_test = sample_data_test[i]?.[data_fields[j]]
                        ? sample_data_test[i]?.[data_fields[j]]
                        : null;
                      //console.log(data_fields[j] + ' : ' + sample_test);
                      newobj[data_fields[j]] = sample_test
                        ? sample_data_test[i]?.[data_fields[j]]
                        : faker.person.firstName();
                    }
                    sent_scehma_subjects.push(newobj);
                  }
                  /*console.log(
                    JSON.stringify(
                      {
                        'Sample Schema Data': sent_scehma_subjects,
                      },
                      null,
                      '\t',
                    ),
                  );*/
                  //sent issue credentials
                  //upload proof Of Enrollment
                  spin.start(
                    `Creating ${schema_list[i_schema].schema_name} against sample records...`,
                  );
                  let issue_response = await new Promise<any>(async (done) => {
                    var data = JSON.stringify({
                      schema_id: schema_list[i_schema].schema_id,
                      issuerDetail: {
                        did: ISSUER_DID,
                      },
                      vcData: {
                        issuanceDate: '2023-04-06T11:56:27.259Z',
                        expirationDate: '2023-12-06T11:56:27.259Z',
                      },
                      credentialSubject: sent_scehma_subjects,
                    });
                    const url = BULK_ISSUANCE_URL + '/bulk/v1/credential/issue';
                    const config: AxiosRequestConfig = {
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    };
                    let response_data = null;
                    try {
                      const observable = this.httpService.post(
                        url,
                        data,
                        config,
                      );
                      const promise = observable.toPromise();
                      const response = await promise;
                      response_data = response.data;
                    } catch (e) {
                      response_data = { error: e };
                    }
                    done(response_data);
                  });
                  if (
                    issue_response?.error ||
                    issue_response?.success === false
                  ) {
                    spin.fail(
                      `Creating ${schema_list[i_schema].schema_name} Failed.`,
                    );
                    console.log(
                      JSON.stringify(
                        issue_response?.error
                          ? issue_response.error
                          : issue_response?.result
                          ? issue_response.result
                          : {},
                        null,
                        '\t',
                      ),
                    );
                  } else {
                    spin.succeed(
                      `${schema_list[i_schema].schema_name} created successfully `,
                    );
                    console.log(JSON.stringify(issue_response, null, '\t'));
                  }
                }
              }
              //create keycloak account
              for (let i = 0; i < sample_data_test.length; i++) {
                console.log('#################');
                console.log(sample_data_test[i].student_name);
                //get first schema
                spin.start(
                  `Registering ...${sample_data_test[i].student_name}`,
                );
                let register_response = await new Promise<any>(async (done) => {
                  const data = JSON.stringify({
                    name: sample_data_test[i].student_name,
                    dob: sample_data_test[i].dob,
                    gender: sample_data_test[i].gender,
                    recoveryphone: sample_data_test[i].recoveryphone,
                    username: sample_data_test[i].username,
                    password: sample_data_test[i].password,
                    aadhar_token: sample_data_test[i].aadhar_token,
                  });
                  const url = BULK_ISSUANCE_URL + '/bulk/v1/user/create';
                  const config: AxiosRequestConfig = {
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  };
                  let response_data = null;
                  try {
                    const observable = this.httpService.post(url, data, config);
                    const promise = observable.toPromise();
                    const response = await promise;
                    response_data = response.data;
                  } catch (e) {
                    response_data = { error: e };
                  }
                  done(response_data);
                });
                if (
                  register_response?.error ||
                  register_response?.success === false
                ) {
                  spin.fail(
                    'Failed to register learner ' +
                      sample_data_test[i].student_name,
                  );
                  console.log(
                    JSON.stringify(
                      register_response?.error
                        ? register_response.error
                        : register_response?.result
                        ? register_response.result
                        : {},
                      null,
                      '\t',
                    ),
                  );
                } else {
                  spin.succeed(
                    `Registered Learner in Keycloak...${sample_data_test[i].student_name}`,
                  );
                }
              }
              //show login details
              //give result logs
              spin.start(
                `Do check the sample records and created frontend on the below links...`,
              );
              let result_output = await new Promise<any>(async (done) => {
                let result_output_object = new Object();
                result_output_object['Detail'] = {
                  'Ewallet URL': EWALLET_URL,
                  'Ewallet Instruction':
                    'Open URL in web browser, click on login and use below learner username and password to view Credentials Certificate.',
                  'Verification URL': VERIFICATION_URL,
                  'Verification Instruction':
                    'Open URL in web browser, scan credentials code and check verification status',
                };
                let learner_accounts = [];
                for (let i = 0; i < sample_data_test.length; i++) {
                  learner_accounts.push({
                    username: sample_data_test[i].username,
                    password: sample_data_test[i].password,
                  });
                }
                result_output_object['Learner Accounts'] = learner_accounts;
                done(result_output_object);
              });
              spin.succeed('Loaded Result.');
              console.log(JSON.stringify(result_output, null, '\t'));
            }
          }

          /*
          //issuer token
          spin.start(`Getting Issuer Token...`);
          let issuer_response = await new Promise<any>(async (done) => {
            const data = JSON.stringify({
              //username: ISSUER_ID,
              username: 'test1',
              password: DEFAULT_PASSWORD,
            });
            const url = BULK_ISSUANCE_URL + '/bulk/v1/issuertoken';
            const config: AxiosRequestConfig = {
              headers: {
                'Content-Type': 'application/json',
              },
            };
            let response_data = null;
            try {
              const observable = this.httpService.post(url, data, config);
              const promise = observable.toPromise();
              const response = await promise;
              response_data = response.data;
            } catch (e) {
              response_data = { error: e };
            }
            done(response_data);
          });
          if (issuer_response?.error || issuer_response?.success === false) {
            spin.fail('Failed to get issuer access token to create credential');
            console.log(
              JSON.stringify(
                issuer_response?.error
                  ? issuer_response.error
                  : issuer_response?.result
                  ? issuer_response.result
                  : {},
                null,
                '\t',
              ),
            );
          } else {
            spin.succeed('Got Issuer access Token to create credentials');
            let issuer_token = issuer_response.result;
            console.log(
              JSON.stringify(
                {
                  'Issuer Token': issuer_token,
                },
                null,
                '\t',
              ),
            );
            //creating sample data files
            spin.start(`Creating sample CSV Files to create dummy records...`);
            let enrollment_csv_data = [];
            let assessment_csv_data = [];
            let csv_files_status = await new Promise<any>(async (done) => {
              let working_dir = __dirname + '/temp/';
              const run_date_time = moment(moment().toDate()).format(
                'DD_MMM_YYYY_hh_mm_ss_a',
              );
              let enrollment_csv =
                working_dir + run_date_time + '_enrollment.csv';
              let assessment_csv =
                working_dir + run_date_time + '_assessment.csv';
              //generate sample data
              const startDate_dob = new Date('1990-01-01');
              const endDate_dob = new Date('2005-12-31');
              const timeDiff_dob =
                endDate_dob.getTime() - startDate_dob.getTime();
              const startDate = new Date('2020-01-01');
              const endDate = new Date('2022-12-31');
              const timeDiff = endDate.getTime() - startDate.getTime();
              for (let i = 0; i < 10; i++) {
                let student_first_name = faker.person.firstName();
                let student_last_name = faker.person.lastName();
                let student_username_name_temp =
                  student_first_name +
                  '_' +
                  Math.floor(Math.random() * 1000 + 1);
                let student_username_name =
                  student_username_name_temp.toLowerCase();
                let student_email = student_username_name + '@gmail.com';
                let student_full_name =
                  student_first_name + ' ' + student_last_name;
                let student_id =
                  Math.floor(Math.random() * 1000 + 1) +
                  '_' +
                  student_username_name;
                let guardian_name =
                  faker.person.firstName() + ' ' + faker.person.lastName();
                let student_contact = '9999999999';
                const randomTime_dob = Math.random() * timeDiff_dob;
                const randomDate_dob = new Date(
                  startDate_dob.getTime() + randomTime_dob,
                );
                const randomDate_dob_txt = randomDate_dob
                  .toISOString()
                  .slice(0, 10);
                let student_dob = randomDate_dob_txt;
                const randomTime = Math.random() * timeDiff;
                const randomDate = new Date(startDate.getTime() + randomTime);
                const randomDate_txt = randomDate.toISOString().slice(0, 10);
                let student_enrolled_on = randomDate_txt;
                let student_aadhar_token = md5(student_id);
                let student_marks = Math.floor(Math.random() * 300 + 1);
                enrollment_csv_data.push({
                  username: student_username_name,
                  student_name: student_full_name,
                  email: student_email,
                  contact: student_contact,
                  student_id: student_id,
                  reference_id: 'ref_' + student_id,
                  guardian_name: guardian_name,
                  enrolled_on: student_enrolled_on,
                  aadhar_token: student_aadhar_token,
                  dob: student_dob,
                });
                assessment_csv_data.push({
                  username: student_username_name,
                  student_name: student_full_name,
                  email: student_email,
                  contact: student_contact,
                  dob: student_dob,
                  student_id: student_id,
                  reference_id: 'ref_' + student_id,
                  aadhar_token: student_aadhar_token,
                  marks: student_marks,
                });
              }
              //generate csv file
              //enrollment_csv
              stringify(
                enrollment_csv_data,
                {
                  header: true,
                },
                async function (err, output) {
                  fs.writeFile(enrollment_csv, output, 'utf8', function (err) {
                    if (err) {
                      done({
                        error: err,
                      });
                    } else {
                      //enrollment_csv
                      stringify(
                        assessment_csv_data,
                        {
                          header: true,
                        },
                        function (err, output) {
                          fs.writeFile(
                            assessment_csv,
                            output,
                            'utf8',
                            function (err) {
                              if (err) {
                                done({
                                  error: err,
                                });
                              } else {
                                done({
                                  Enrollment: enrollment_csv,
                                  Assessment: assessment_csv,
                                });
                              }
                            },
                          );
                        },
                      );
                    }
                  });
                },
              );
            });
            if (csv_files_status?.error) {
              spin.fail('CSV Files Creation Failed.');
              console.log(JSON.stringify(csv_files_status, null, '\t'));
            } else {
              spin.succeed('CSV Files Created.');
              console.log(JSON.stringify(csv_files_status, null, '\t'));
              //post generated files to bulk enrollment and bulk assance
              //upload proof Of Enrollment
              spin.start(
                `Creating proof Of Enrollment against sample records...`,
              );
              let enrollment_response = await new Promise<any>(async (done) => {
                var data = new FormData();
                data.append(
                  'csvfile',
                  fs.createReadStream(csv_files_status.Enrollment),
                );
                data.append(
                  'issuerDetail',
                  '{"did":"' +
                    ISSUER_DID +
                    '","schoolid":"09580413502","schoolName":"CENTRAL PUBLIC ACEDEMY"}',
                );
                data.append(
                  'vcData',
                  '{"issuanceDate":"2023-01-06T11:56:27.259Z","expirationDate":"2023-10-06T11:56:27.259Z"}',
                );
                data.append(
                  'credentialSubjectCommon',
                  '{"grade":"class-7","academic_year":"2023-2024"}',
                );
                const url =
                  BULK_ISSUANCE_URL + '/bulk/v1/uploadFiles/proofOfEnrollment';
                const config: AxiosRequestConfig = {
                  headers: {
                    Authorization: 'Bearer ' + issuer_token,
                    ...data.getHeaders(),
                  },
                };
                let response_data = null;
                try {
                  const observable = this.httpService.post(url, data, config);
                  const promise = observable.toPromise();
                  const response = await promise;
                  response_data = response.data;
                } catch (e) {
                  response_data = { error: e };
                }
                done(response_data);
              });
              if (
                enrollment_response?.error ||
                enrollment_response?.success === false
              ) {
                spin.fail('Creating proof Of Enrollment Failed.');
                console.log(
                  JSON.stringify(
                    enrollment_response?.error
                      ? enrollment_response.error
                      : enrollment_response?.result
                      ? enrollment_response.result
                      : {},
                    null,
                    '\t',
                  ),
                );
              } else {
                spin.succeed(
                  'proofOfEnrollment created successfully ' +
                    csv_files_status.Enrollment,
                );
                console.log(JSON.stringify(enrollment_response, null, '\t'));
                //upload proof Of Assessment
                spin.start(
                  `Creating sample records for proof Of Assessment credentials...`,
                );
                let assessment_response = await new Promise<any>(
                  async (done) => {
                    var data = new FormData();
                    data.append(
                      'csvfile',
                      fs.createReadStream(csv_files_status.Assessment),
                    );
                    data.append(
                      'issuerDetail',
                      '{"did":"' +
                        ISSUER_DID +
                        '","schoolid":"09580413502","schoolName":"CENTRAL PUBLIC ACEDEMY"}',
                    );
                    data.append(
                      'vcData',
                      '{"issuanceDate":"2023-01-06T11:56:27.259Z","expirationDate":"2023-10-06T11:56:27.259Z"}',
                    );
                    data.append(
                      'credentialSubjectCommon',
                      '{"grade":"class-6","academic_year":"2022-2023","assessment":"NAT assessment Lucknow mandal","total":"300","quarterlyAssessment":"3"}',
                    );
                    const url =
                      BULK_ISSUANCE_URL +
                      '/bulk/v1/uploadFiles/proofOfAssessment';
                    const config: AxiosRequestConfig = {
                      headers: {
                        Authorization: 'Bearer ' + issuer_token,
                        ...data.getHeaders(),
                      },
                    };
                    let response_data = null;
                    try {
                      const observable = this.httpService.post(
                        url,
                        data,
                        config,
                      );
                      const promise = observable.toPromise();
                      const response = await promise;
                      response_data = response.data;
                    } catch (e) {
                      response_data = { error: e };
                    }
                    done(response_data);
                  },
                );
                if (
                  assessment_response?.error ||
                  assessment_response?.success === false
                ) {
                  spin.fail('Creating proof Of Assessment credentials Failed.');
                  console.log(
                    JSON.stringify(
                      assessment_response?.error
                        ? assessment_response.error
                        : assessment_response?.result
                        ? assessment_response.result
                        : {},
                      null,
                      '\t',
                    ),
                  );
                } else {
                  spin.succeed(
                    'Uploaded proofOfAssessment. File ' +
                      csv_files_status.Assessment,
                  );
                  console.log(JSON.stringify(assessment_response, null, '\t'));
                  //give result logs
                  spin.start(
                    `Do check the sample records and created frontend on the below links...`,
                  );
                  let result_output = await new Promise<any>(async (done) => {
                    let result_output_object = new Object();
                    result_output_object['Detail'] = {
                      'Ewallet URL': EWALLET_URL,
                      'Ewallet Instruction':
                        'Open URL in web browser, click on login and use below learner username and password to view Credentials Certificate.',
                      'Verification URL': VERIFICATION_URL,
                      'Verification Instruction':
                        'Open URL in web browser, scan credentials code and check verification status',
                    };
                    let learner_accounts = [];
                    for (let i = 0; i < enrollment_csv_data.length; i++) {
                      learner_accounts.push({
                        username: enrollment_csv_data[i].username,
                        password: DEFAULT_PASSWORD,
                      });
                    }
                    result_output_object['Learner Accounts'] = learner_accounts;
                    done(result_output_object);
                  });
                  spin.succeed('Loaded Result.');
                  console.log(JSON.stringify(result_output, null, '\t'));
                }
              }
            }
          }*/
        }
      }
    }
  }
  async readFiles(
    httpService: HttpService,
    dirname,
    onFileContent,
    onError,
    onComplete,
  ) {
    let count = 0;
    let sample_schema = [];
    fs.readdir(dirname, function (err, filenames) {
      //console.log('dirname', dirname);
      if (err) {
        console.log(err);
        onError(err);
        return;
      }
      filenames.forEach(function (filename) {
        count++;
        fs.readFile(dirname + filename, 'utf-8', function (err, content) {
          //console.log('filename', dirname + filename);
          if (err) {
            console.log(err);
            onError(err);
            return;
          }
          sample_schema.push({ filename: filename, content: content });
          onFileContent(httpService, filename, content);
        });
        if (filenames.length === count) {
          onComplete(sample_schema);
        }
      });
    });
  }
  delay = (ms) => new Promise((res) => setTimeout(res, ms));
}
