import React, { FC, memo, useCallback, useState } from "react";
import {
  makeStyles,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from "@material-ui/core";
import { PipelineStage } from "./pipeline-stage";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../modules";
import {
  selectById,
  Deployment,
  Stage,
  approveStage,
  isDeploymentRunning,
} from "../modules/deployments";
import { fetchStageLog } from "../modules/stage-logs";
import { updateActiveStage, ActiveStage } from "../modules/active-stage";
import { ApprovalStage } from "./approval-stage";
import clsx from "clsx";
import { StageStatus } from "pipe/pkg/app/web/model/deployment_pb";
import { METADATA_APPROVED_BY } from "../constants/metadata-keys";

const WAIT_APPROVAL_NAME = "WAIT_APPROVAL";

const useConvertedStages = (deploymentId: string): [boolean, Stage[][]] => {
  const stages: Stage[][] = [];
  const deployment = useSelector<AppState, Deployment | undefined>((state) =>
    selectById(state.deployments, deploymentId)
  );

  if (!deployment) {
    return [false, stages];
  }

  const isRunning = isDeploymentRunning(deployment.status);

  stages[0] = deployment.stagesList.filter(
    (stage) => stage.requiresList.length === 0 && stage.visible
  );

  let index = 0;
  while (stages[index].length > 0) {
    const previousIds = stages[index].map((stage) => stage.id);
    index++;
    stages[index] = deployment.stagesList.filter(
      (stage) =>
        stage.requiresList.some((id) => previousIds.includes(id)) &&
        stage.visible
    );
  }
  return [isRunning, stages];
};

const STAGE_HEIGHT = 56;
const APPROVED_STAGE_HEIGHT = 66;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    justifyContent: "center",
  },
  pipelineColumn: {
    display: "flex",
    flexDirection: "column",
  },
  stage: {
    display: "flex",
    padding: theme.spacing(2),
  },
  requireLine: {
    position: "relative",
    "&::before": {
      content: '""',
      position: "absolute",
      top: "48%",
      left: -theme.spacing(2),
      borderTop: `2px solid ${theme.palette.divider}`,
      width: theme.spacing(4),
      height: 1,
    },
  },
  requireCurvedLine: {
    position: "relative",
    "&::before": {
      content: '""',
      position: "absolute",
      bottom: "50%",
      left: 0,
      borderLeft: `2px solid ${theme.palette.divider}`,
      borderBottom: `2px solid ${theme.palette.divider}`,
      width: theme.spacing(2),
      height: STAGE_HEIGHT + theme.spacing(4),
    },
  },
  extendRequireLine: {
    "&::before": {
      height: APPROVED_STAGE_HEIGHT + theme.spacing(4),
    },
  },
  approveDialog: {
    display: "flex",
  },
}));

interface Props {
  deploymentId: string;
}

const findApprover = (
  metadata: Array<[string, string]>
): string | undefined => {
  const res = metadata.find(([key]) => key === METADATA_APPROVED_BY);

  if (res) {
    return res[1];
  }

  return undefined;
};

export const Pipeline: FC<Props> = memo(function Pipeline({ deploymentId }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const isOpenApproveDialog = Boolean(approveTargetId);
  const [isRunning, stages] = useConvertedStages(deploymentId);
  const activeStage = useSelector<AppState, ActiveStage>(
    (state) => state.activeStage
  );

  const handleOnClickStage = useCallback(
    (stageId: string, stageName: string) => {
      dispatch(
        fetchStageLog({
          deploymentId,
          stageId,
          offsetIndex: 0,
          retriedCount: 0,
        })
      );
      dispatch(updateActiveStage({ deploymentId, stageId, name: stageName }));
    },
    [dispatch, deploymentId]
  );

  const handleApprove = (): void => {
    if (approveTargetId) {
      dispatch(approveStage({ deploymentId, stageId: approveTargetId }));
      setApproveTargetId(null);
    }
  };

  return (
    <div className={classes.root}>
      {stages.map((stageColumn, columnIndex) => {
        let isPrevStageApproval = false;
        return (
          <div
            className={classes.pipelineColumn}
            key={`pipeline-${columnIndex}`}
          >
            {stageColumn.map((stage, stageIndex) => {
              const approver = findApprover(stage.metadataMap);
              const isActive = activeStage
                ? activeStage.deploymentId === deploymentId &&
                  activeStage.stageId === stage.id
                : false;
              const stageComp = (
                <div
                  key={stage.id}
                  className={clsx(
                    classes.stage,
                    columnIndex > 0
                      ? stageIndex > 0
                        ? clsx(classes.requireCurvedLine, {
                            [classes.extendRequireLine]:
                              Boolean(approver) || isPrevStageApproval,
                          })
                        : classes.requireLine
                      : undefined
                  )}
                >
                  {stage.name === WAIT_APPROVAL_NAME &&
                  stage.status === StageStatus.STAGE_RUNNING ? (
                    <ApprovalStage
                      id={stage.id}
                      name={stage.name}
                      onClick={() => {
                        setApproveTargetId(stage.id);
                      }}
                      active={isActive}
                    />
                  ) : (
                    <PipelineStage
                      id={stage.id}
                      name={stage.name}
                      status={stage.status}
                      onClick={handleOnClickStage}
                      active={isActive}
                      approver={findApprover(stage.metadataMap)}
                      isDeploymentRunning={isRunning}
                    />
                  )}
                </div>
              );
              isPrevStageApproval = Boolean(approver);
              return stageComp;
            })}
          </div>
        );
      })}

      <Dialog
        open={isOpenApproveDialog}
        onClose={() => setApproveTargetId(null)}
      >
        <DialogTitle>Approve stage</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`To continue deploying, click "APPROVE".`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveTargetId(null)}>CANCEL</Button>
          <Button color="primary" onClick={handleApprove}>
            APPROVE
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
});
